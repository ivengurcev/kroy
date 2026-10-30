import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { pool } from '../db/client.mjs';
import patchPage from './patchPage.mjs';

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

test('detail template settings remain saved after PATCH', async (t) => {
    if (process.env.RUN_PAGE_INTEGRATION_TESTS !== '1') {
        t.skip('Set RUN_PAGE_INTEGRATION_TESTS=1 to run page database integration tests');
        return;
    }
    assert.ok(process.env.PAGE_TEST_DATABASE, 'Set PAGE_TEST_DATABASE to the isolated database name');
    const { rows: [{ current_database: currentDatabase }] } = await pool.query('SELECT current_database()');
    assert.equal(currentDatabase, process.env.PAGE_TEST_DATABASE);

    const suffix = randomUUID();
    const hostname = `pages-${suffix}.example`;
    const site = (await pool.query(
        'INSERT INTO sites (slug, name) VALUES ($1, $2) RETURNING id',
        [`pages-${suffix}`, 'Pages test'],
    )).rows[0];

    try {
        await pool.query('INSERT INTO domains (site_id, hostname) VALUES ($1, $2)', [site.id, hostname]);
        const listPage = (await pool.query(
            `INSERT INTO pages (site_id, path, title, page_type, data_source)
             VALUES ($1, '/cases', 'Cases', 'list', 'articles') RETURNING id`,
            [site.id],
        )).rows[0];
        const template = (await pool.query(
            `INSERT INTO pages (site_id, path, title, page_type, detail_parent_id, route_param)
             VALUES ($1, '/cases/:slug', 'Case details', 'detail', $2, 'slug') RETURNING id`,
            [site.id, listPage.id],
        )).rows[0];

        const response = await patchPage(context(hostname, template.id, {
            title: 'Case view',
            routeParam: 'caseId',
        }));
        const saved = (await pool.query(
            'SELECT page_type, route_param, path, title FROM pages WHERE id = $1',
            [template.id],
        )).rows[0];

        assert.equal(response.type, 'detail');
        assert.equal(response.routeParam, 'caseId');
        assert.deepEqual(saved, {
            page_type: 'detail',
            route_param: 'caseId',
            path: '/cases/:caseId',
            title: 'Case view',
        });
    } finally {
        await pool.query('DELETE FROM pages WHERE site_id = $1', [site.id]);
        await pool.query('DELETE FROM domains WHERE site_id = $1', [site.id]);
        await pool.query('DELETE FROM sites WHERE id = $1', [site.id]);
    }
});
