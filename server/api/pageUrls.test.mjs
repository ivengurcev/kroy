import assert from 'node:assert/strict';
import test from 'node:test';
import { pool } from '../../db/client.mjs';
import postPage from './postPage.mjs';
import restorePage from './restorePage.mjs';
import getPage from './getPage.mjs';
import findPageRouteConflict from './pageRouteConflicts.mjs';

const id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const ctx = (body, query = {}) => ({
    req: { header: () => 'site.example', param: () => undefined, json: async () => body, query: (key) => query[key] },
    json: (value, status = 200) => ({ value, status }),
});

test('route checks exclude deleted pages but retain active dynamic intersections', async () => {
    let active = [];
    const client = { async query(sql) {
        if (sql.includes('FROM pages')) {
            assert.match(sql, /deleted_at IS NULL/);
            return { rows: active };
        }
        return { rows: [] };
    } };
    assert.equal(await findPageRouteConflict(client, id, '/news/example'), null);
    active = [{ id, path: '/news/:slug' }];
    assert.deepEqual(await findPageRouteConflict(client, id, '/news/example', { reclaimRedirects: true }), { type: 'page', path: '/news/:slug' });
});

test('creation frees redirect atomically, inserts a fresh UUID/default content instead of resurrecting old data', async (t) => {
    const calls = [];
    t.mock.method(pool, 'connect', async () => ({
        release() {},
        async query(sql, values) {
            calls.push({ sql, values });
            if (sql.includes('FOR UPDATE OF s')) return { rows: [{ id }] };
            if (sql.startsWith('SELECT from_path')) return { rows: [{ from_path: '/old' }, { from_path: '/other' }] };
            if (sql.includes('INSERT INTO pages')) {
                assert.ok(sql.includes("'[]'::jsonb"));
                assert.doesNotMatch(sql, /UPDATE|deleted_at|detail_parent_id|seo/);
                assert.deepEqual(values, [id, 'New', '/old', 'standard', null, null]);
                return { rows: [{ id: 'new-uuid', path: '/old', title: 'New', content: [] }] };
            }
            return { rows: [] };
        },
    }));
    const response = await postPage(ctx({ title: 'New', path: '/old' }));
    assert.equal(response.status, 201);
    assert.equal(response.value.id, 'new-uuid');
    const deletion = calls.findIndex(({ sql }) => sql.startsWith('DELETE FROM redirects'));
    const insertion = calls.findIndex(({ sql }) => sql.includes('INSERT INTO pages'));
    assert.ok(deletion > calls.findIndex(({ sql }) => sql.includes('FOR UPDATE OF s')));
    assert.ok(insertion > deletion);
    assert.deepEqual(calls[deletion].values, [id, ['/old']]);
    assert.equal(calls.at(-1).sql, 'COMMIT');
});

test('active page conflict rolls back without removing redirects or writing pages', async (t) => {
    const calls = [];
    t.mock.method(pool, 'connect', async () => ({ release() {}, async query(sql) {
        calls.push(sql);
        if (sql.includes('FOR UPDATE OF s')) return { rows: [{ id }] };
        if (sql.includes('FROM pages')) return { rows: [{ id, path: '/old' }] };
        return { rows: [] };
    } }));
    const response = await postPage(ctx({ title: 'New', path: '/old' }));
    assert.equal(response.status, 409);
    assert.ok(response.value.fields.path);
    assert.equal(calls.at(-1), 'ROLLBACK');
    assert.ok(!calls.some((sql) => /INSERT|DELETE/.test(sql)));
});

test('restoration locks site before page and rejects an occupied URL', async (t) => {
    const calls = [];
    t.mock.method(pool, 'connect', async () => ({ release() {}, async query(sql) {
        calls.push(sql);
        if (sql.includes('SELECT p.*')) return { rows: [{ id, path: '/old', site_id: id, page_type: 'standard' }] };
        if (sql.includes('SELECT id, path')) return { rows: [{ id: 'other', path: '/old' }] };
        return { rows: [] };
    } }));
    const context = ctx({});
    context.req.param = () => id;
    assert.equal((await restorePage(context)).status, 409);
    assert.ok(calls.findIndex((sql) => sql.includes('FOR UPDATE OF s')) < calls.findIndex((sql) => sql.includes('SELECT p.*')));
    assert.ok(!calls.some((sql) => sql.includes('UPDATE pages')));
});

test('list API includes only live non-self redirects, supports deleted=all and keeps tenant scope', async (t) => {
    t.mock.method(pool, 'query', async (sql, values) => {
        assert.match(sql, /p.deleted_at IS NULL AND p.page_type <> 'detail'/);
        assert.match(sql, /r.from_path <> p.path/);
        assert.match(sql, /NOT EXISTS/);
        assert.match(sql, /WHERE d.hostname = \$1/);
        assert.deepEqual(values, ['site.example', true]);
        return { rows: [{ id, redirects: ['/old'], deleted_at: null }] };
    });
    assert.deepEqual((await getPage(ctx({}, { deleted: 'all' })))[0].redirects, ['/old']);
});
