import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { pool } from '../../db/client.mjs';
import { createMainPageTemplate } from '../../db/pageTemplates.mjs';
import { getSiteFingerprint } from '../../db/siteFingerprint.mjs';
import { createTemplate, deleteTemplate, getTemplate, getTemplates, patchDefaultTemplate, putTemplate } from './pageTemplates.mjs';
import getPage from './getPage.mjs';
import putPage from './putPage.mjs';

test('layout and global footer writes share one transaction and detect concurrent editor changes', async (t) => {
    if (process.env.RUN_PAGE_INTEGRATION_TESTS !== '1') return t.skip('Requires isolated migrated PostgreSQL');
    const { rows: [{ current_database: database }] } = await pool.query('SELECT current_database()');
    assert.equal(database, process.env.PAGE_TEST_DATABASE);
    assert.match(database, /test/i);
    const sites = [];
    const context = (body, id, hostname, params = {}) => ({
        req: { header: () => hostname, param: (name) => params[name] ?? id, json: async () => body, query: () => undefined },
        json: (value, status = 200) => ({ value, status }),
        body: (value, status) => ({ value, status }),
    });
    async function createSite() {
        const slug = `layout-${randomUUID()}`;
        const hostname = `${slug}.example`;
        const { rows: [site] } = await pool.query('INSERT INTO sites (slug, name) VALUES ($1, $1) RETURNING id', [slug]);
        sites.push(site.id);
        await createMainPageTemplate(pool, site.id);
        await pool.query('INSERT INTO domains (site_id, hostname) VALUES ($1, $2)', [site.id, hostname]);
        const { rows: [page] } = await pool.query("INSERT INTO pages (site_id, path, title) VALUES ($1, '/', 'Home') RETURNING id", [site.id]);
        return { ...site, hostname, pageId: page.id };
    }

    try {
        const site = await createSite();
        const foreign = await createSite();
        const call = (fn, body, id) => fn(context(body, id, site.hostname));
        const { value: list } = await call(getTemplates);
        const main = list.mainTemplateId;
        assert.equal(list.defaultTemplateId, main);
        assert.equal(list.templates[0].inherited, 1);
        assert.equal((await call(deleteTemplate, null, main)).value.code, 'main_template');
        const { value: extra, status } = await call(createTemplate, { name: 'Extra' });
        assert.equal(status, 201);
        assert.equal((await getTemplate(context(null, extra.id, foreign.hostname))).status, 404);
        assert.equal((await putTemplate(context({ footerChanges: { expectedVersion: 1, props: {} } }, extra.id, foreign.hostname))).status, 404);
        assert.equal((await call(patchDefaultTemplate, { templateId: extra.id, expectedDefaultTemplateId: main })).status, 200);
        assert.equal((await call(deleteTemplate, null, extra.id)).value.code, 'default_template');
        assert.equal((await call(getPage, null, site.pageId)).effectiveTemplateId, extra.id);
        assert.equal((await call(patchDefaultTemplate, { templateId: null, expectedDefaultTemplateId: extra.id })).status, 200);
        assert.equal((await call(deleteTemplate, null, extra.id)).status, 204);

        const saved = await call(getTemplate, null, main);
        const before = await getSiteFingerprint(site.id);
        const footerChanges = { expectedVersion: 1, props: { description: 'Shared', navigation: [{ pageId: site.pageId }] } };
        const forbidden = await call(putPage, {
            expectedSelection: { mode: 'inherit', id: null }, expectedDefaultTemplateId: main,
            templateChanges: { id: main, expectedVersion: 1, propsByIndex: { 0: {} }, slotIndex: 0 },
        }, site.pageId);
        assert.equal(forbidden.status, 400);
        for (const props of [
            { showBranding: false },
            { navigation: [{ pageId: foreign.pageId }] },
            { documents: { additional: [{ label: 'Home', url: `https://${site.hostname}/` }] } },
        ]) {
            assert.equal((await call(putTemplate, { footerChanges: { props, expectedVersion: 1 } }, main)).status, 400);
        }
        const rejected = await call(putTemplate, {
            name: saved.value.name, content: saved.value.content, slotIndex: 5, expectedVersion: 1, footerChanges,
        }, main);
        assert.equal(rejected.status, 400);
        assert.equal(await getSiteFingerprint(site.id), before);

        const expectedSelection = { mode: 'inherit', id: null };
        const [pageWrite, templateWrite] = await Promise.all([
            call(putPage, {
                expectedSelection, expectedDefaultTemplateId: main,
                templateChanges: { id: main, expectedVersion: 1, propsByIndex: { 0: { title: 'New heading' } } },
                footerChanges,
            }, site.pageId),
            call(putTemplate, { footerChanges }, main),
        ]);
        assert.deepEqual([pageWrite.status, templateWrite.status].sort(), [200, 409]);
        assert.equal((pageWrite.status === 409 ? pageWrite : templateWrite).value.code, 'footer_conflict');
        const { rows: [footer] } = await pool.query('SELECT footer_settings, footer_version FROM sites WHERE id = $1', [site.id]);
        assert.equal(footer.footer_version, 2);
        assert.equal(footer.footer_settings.description, 'Shared');
        assert.deepEqual(footer.footer_settings.navigation, [{ pageId: site.pageId }]);
        assert.notEqual(await getSiteFingerprint(site.id), before);
        assert.equal((await call(putPage, { content: [] }, site.pageId)).content.length, 0);
        const select = await call(putPage, { expectedSelection, templateSelection: { mode: 'none', id: null } }, site.pageId);
        assert.equal(select.value.templateMode, 'none');
        assert.equal((await call(getPage, null, site.pageId)).effectiveTemplateId, null);
        const { rows: [after] } = await pool.query('SELECT footer_version FROM sites WHERE id = $1', [site.id]);
        assert.equal(after.footer_version, 2);
    } finally {
        await pool.query('DELETE FROM pages WHERE site_id = ANY($1::uuid[])', [sites]);
        await pool.query('DELETE FROM domains WHERE site_id = ANY($1::uuid[])', [sites]);
        await pool.query('DELETE FROM sites WHERE id = ANY($1::uuid[])', [sites]);
        await pool.end();
    }
});
