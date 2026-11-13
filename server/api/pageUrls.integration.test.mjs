import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { pool } from '../../db/client.mjs';
import postPage from './postPage.mjs';
import patchPage from './patchPage.mjs';
import postDetailTemplate from './postDetailTemplate.mjs';
import deletePage from './deletePage.mjs';
import restorePage from './restorePage.mjs';

test('URL reuse, template dependencies and concurrent route mutations in PostgreSQL', async (t) => {
    if (process.env.RUN_PAGE_INTEGRATION_TESTS !== '1') {
        t.skip('Requires RUN_PAGE_INTEGRATION_TESTS=1 and PAGE_TEST_DATABASE (isolated migrated database)');
        return;
    }
    assert.ok(process.env.PAGE_TEST_DATABASE);
    assert.equal((await pool.query('SELECT current_database()')).rows[0].current_database, process.env.PAGE_TEST_DATABASE);
    const suffix = randomUUID();
    const hostname = `pages-${suffix}.example`;
    const site = (await pool.query('INSERT INTO sites (slug, name) VALUES ($1, $2) RETURNING id', [`pages-${suffix}`, 'URL tests'])).rows[0];
    const context = (body, pageId) => ({
        req: { header: () => hostname, param: () => pageId, json: async () => body },
        json: (value, status = 200) => ({ value, status }),
        body: (value, status) => ({ value, status }),
    });
    const create = (path, extra = {}) => postPage(context({ title: 'New', path, ...extra }));
    try {
        await pool.query('INSERT INTO domains (site_id, hostname) VALUES ($1, $2)', [site.id, hostname]);
        await t.test('deleted URL yields a new empty page, old data and redirects never transfer; restore conflicts', async () => {
            const old = (await create('/old', { type: 'list', dataSource: 'products' })).value;
            await pool.query(`UPDATE pages SET content = '[{"old":true}]', seo = '{"title":"Old SEO"}' WHERE id = $1`, [old.id]);
            await pool.query('INSERT INTO redirects VALUES ($1, $2, $3)', [site.id, '/old-alias', old.id]);
            await deletePage(context(null, old.id));
            const result = await create('/old');
            assert.equal(result.status, 201);
            assert.notEqual(result.value.id, old.id);
            const fresh = (await pool.query('SELECT * FROM pages WHERE id = $1', [result.value.id])).rows[0];
            assert.deepEqual(fresh.content, []);
            assert.deepEqual(fresh.seo, {});
            assert.equal(fresh.title, 'New');
            assert.equal(fresh.page_type, 'standard');
            assert.equal(fresh.data_source, null);
            assert.equal(fresh.material_section_id, null);
            assert.equal(fresh.detail_parent_id, null);
            assert.equal(fresh.route_param, null);
            assert.equal((await pool.query('SELECT 1 FROM redirects WHERE page_id = $1', [fresh.id])).rowCount, 0);
            assert.equal((await restorePage(context(null, old.id))).status, 409);
        });
        await t.test('301 URL is reclaimed without changing the target page', async () => {
            const target = (await create('/target')).value;
            await pool.query('INSERT INTO redirects VALUES ($1, $2, $3)', [site.id, '/alias', target.id]);
            assert.equal((await create('/alias')).status, 201);
            assert.equal((await pool.query('SELECT 1 FROM redirects WHERE site_id = $1 AND from_path = $2', [site.id, '/alias'])).rowCount, 0);
            assert.equal((await create('/target')).status, 409);
        });
        await t.test('list and template move together; deleted templates stop reserving routes', async () => {
            const list = (await create('/news', { type: 'list', dataSource: 'products' })).value;
            const template = (await postDetailTemplate(context({ title: 'Detail', routeParam: 'slug' }, list.id))).value;
            assert.equal((await create('/news/item')).status, 409);
            assert.equal((await deletePage(context(null, list.id))).status, 409);
            const changed = await patchPage(context({ path: '/updates' }, list.id));
            assert.equal(changed.detailTemplateId, template.id);
            assert.equal(changed.detailTemplatePath, '/updates/:slug');
            assert.equal((await pool.query('SELECT detail_parent_id FROM pages WHERE id = $1', [template.id])).rows[0].detail_parent_id, list.id);
            await deletePage(context(null, template.id));
            assert.equal((await create('/updates/item')).status, 201);
            assert.equal((await restorePage(context(null, template.id))).status, 409);
            await deletePage(context(null, list.id));
            const replacement = await create('/updates');
            assert.equal(replacement.status, 201);
            assert.equal((await pool.query('SELECT 1 FROM pages WHERE detail_parent_id = $1', [replacement.value.id])).rowCount, 0);
        });
        await t.test('two simultaneous exact creations have one winner', async () => {
            const results = await Promise.all([create('/race'), create('/race')]);
            assert.deepEqual(results.map(({ status }) => status).sort(), [201, 409]);
        });
        await t.test('concurrent static creation and detail template creation cannot overlap', async () => {
            const list = (await create('/race-list', { type: 'list', dataSource: 'products' })).value;
            const results = await Promise.all([
                create('/race-list/item'),
                postDetailTemplate(context({ title: 'Detail' }, list.id)),
            ]);
            assert.deepEqual(results.map(({ status }) => status).sort(), [201, 409]);
        });
        await t.test('restoration and creation serialize on the site lock', async () => {
            const old = (await create('/restore-race')).value;
            await deletePage(context(null, old.id));
            const results = await Promise.all([create('/restore-race'), restorePage(context(null, old.id))]);
            assert.equal(results.filter((result) => result.status === 409).length, 1);
            assert.equal((await pool.query('SELECT 1 FROM pages WHERE site_id = $1 AND path = $2 AND deleted_at IS NULL', [site.id, '/restore-race'])).rowCount, 1);
        });
    } finally {
        await pool.query('DELETE FROM redirects WHERE site_id = $1', [site.id]);
        await pool.query('DELETE FROM pages WHERE site_id = $1', [site.id]);
        await pool.query('DELETE FROM domains WHERE site_id = $1', [site.id]);
        await pool.query('DELETE FROM sites WHERE id = $1', [site.id]);
    }
});
