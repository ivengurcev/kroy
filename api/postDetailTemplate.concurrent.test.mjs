import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { pool } from '../db/client.mjs';
import putPage from './putPage.mjs';
import postDetailTemplate from './postDetailTemplate.mjs';

function context(hostname, pageId, body) {
    return {
        req: {
            header(name) { return name === 'Host' ? hostname : undefined; },
            param(name) { return name === 'pageId' ? pageId : undefined; },
            async json() { return body; },
        },
        json(value, status = 200) { return { value, status }; },
    };
}

test('new article templates get editable starter content while existing empty templates stay empty', async (t) => {
    if (process.env.RUN_PAGE_INTEGRATION_TESTS !== '1') {
        t.skip('Set RUN_PAGE_INTEGRATION_TESTS=1 to run page database integration tests');
        return;
    }
    assert.ok(process.env.PAGE_TEST_DATABASE, 'Set PAGE_TEST_DATABASE to the isolated database name');
    const { rows: [{ current_database: currentDatabase }] } = await pool.query('SELECT current_database()');
    assert.equal(currentDatabase, process.env.PAGE_TEST_DATABASE);

    const suffix = randomUUID();
    const hostname = `templates-${suffix}.example`;
    const site = (await pool.query(
        'INSERT INTO sites (slug, name) VALUES ($1, $2) RETURNING id',
        [`templates-${suffix}`, 'Templates test'],
    )).rows[0];

    try {
        await pool.query('INSERT INTO domains (site_id, hostname) VALUES ($1, $2)', [site.id, hostname]);
        const articleList = (await pool.query(
            `INSERT INTO pages (site_id, path, title, page_type, data_source)
             VALUES ($1, '/cases', 'Cases', 'list', 'articles') RETURNING id`,
            [site.id],
        )).rows[0];
        const created = await postDetailTemplate(context(hostname, articleList.id, { title: 'Case detail' }));
        const expected = {
            part: '@kroy/article',
            props: {},
            view: { name: '@kroy/article-content', props: {} },
        };
        assert.equal(created.status, 201);
        assert.deepEqual(created.value.content, [expected]);

        const cleared = await putPage(context(hostname, created.value.id, { content: [] }));
        assert.deepEqual(cleared.content, []);

        const legacyList = (await pool.query(
            `INSERT INTO pages (site_id, path, title, page_type, data_source)
             VALUES ($1, '/legacy', 'Legacy', 'list', 'articles') RETURNING id`,
            [site.id],
        )).rows[0];
        const legacyTemplate = (await pool.query(
            `INSERT INTO pages (site_id, path, title, content, page_type, detail_parent_id, route_param)
             VALUES ($1, '/legacy/:slug', 'Legacy detail', '[]'::jsonb, 'detail', $2, 'slug') RETURNING id`,
            [site.id, legacyList.id],
        )).rows[0];
        const duplicate = await postDetailTemplate(context(hostname, legacyList.id, { title: 'Replacement' }));
        const legacy = (await pool.query('SELECT content FROM pages WHERE id = $1', [legacyTemplate.id])).rows[0];
        assert.equal(duplicate.status, 409);
        assert.deepEqual(legacy.content, []);

        const productList = (await pool.query(
            `INSERT INTO pages (site_id, path, title, page_type, data_source)
             VALUES ($1, '/products', 'Products', 'list', 'products') RETURNING id`,
            [site.id],
        )).rows[0];
        const productTemplate = await postDetailTemplate(context(hostname, productList.id, { title: 'Product detail' }));
        assert.deepEqual(productTemplate.value.content, []);
    } finally {
        await pool.query('DELETE FROM pages WHERE site_id = $1', [site.id]);
        await pool.query('DELETE FROM domains WHERE site_id = $1', [site.id]);
        await pool.query('DELETE FROM sites WHERE id = $1', [site.id]);
    }
});
