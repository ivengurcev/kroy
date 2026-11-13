import assert from 'node:assert/strict';
import test from 'node:test';
import { pool } from '../../db/client.mjs';
import { patchSiteSeo } from './siteSeo.mjs';
import patchPage from './patchPage.mjs';
import { seoReferenceErrors } from './seoValidation.mjs';
import { getSiteFingerprint } from '../../db/siteFingerprint.mjs';
import { toEditorPage } from '../../admin/editor/pageDetails.mjs';

const id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const imageId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const context = (body) => ({ req: { json: async () => body, header: () => 'example.org', param: () => id }, json: (value, status = 200) => ({ value, status }) });

test('SEO image and domain references are scoped to the current site', async () => {
    const calls = [];
    const client = { query: async (sql, values) => { calls.push({ sql, values }); return { rowCount: 0 }; } };
    const fields = await seoReferenceErrors(client, id, { imageId, primaryDomain: 'other.example.org' });
    assert.ok(fields.imageId);
    assert.ok(fields.primaryDomain);
    assert.ok(calls.every(({ sql, values }) => sql.includes('site_id = $2') && values[1] === id));
});
test('site SEO save replaces only SEO, preserving empty fields as inheritance', async (t) => {
    t.mock.method(pool, 'query', async () => ({ rows: [{ id, name: 'Site' }] }));
    let saved;
    t.mock.method(pool, 'connect', async () => ({ release() {}, async query(sql, values) {
        if (sql.startsWith('UPDATE')) { assert.match(sql, /^UPDATE sites SET seo =/); saved = JSON.parse(values[1]); }
        return { rows: [], rowCount: 1 };
    } }));
    const result = await patchSiteSeo(context({ name: '', description: ' ', imageId: null, indexable: false }));
    assert.equal(result.status, 200);
    assert.deepEqual(saved, { indexable: false });
    assert.deepEqual(result.value, saved);
});
test('site rejects cross-site domain/image before writing', async (t) => {
    t.mock.method(pool, 'query', async () => ({ rows: [{ id }] }));
    const calls = [];
    t.mock.method(pool, 'connect', async () => ({ release() {}, async query(sql) { calls.push(sql); return { rows: [], rowCount: 0 }; } }));
    const result = await patchSiteSeo(context({ imageId, primaryDomain: 'other.example.org' }));
    assert.equal(result.status, 400);
    assert.ok(result.value.fields.imageId);
    assert.ok(result.value.fields.primaryDomain);
    assert.equal(calls.some((sql) => sql.startsWith('UPDATE')), false);
});
test('page SEO saves through the existing PATCH transaction and retains overrides in editor model', async (t) => {
    let saved;
    t.mock.method(pool, 'connect', async () => ({ release() {}, async query(sql, values) {
        if (sql.includes('FOR UPDATE OF s')) return { rows: [{ id }] };
        if (sql.includes('SELECT id, site_id, path, title')) return { rows: [{ id, site_id: id, path: '/', title: 'Home', page_type: 'standard', seo: {} }] };
        if (sql.startsWith('UPDATE pages') || sql.includes('UPDATE pages\n')) {
            saved = JSON.parse(values[6]);
            return { rows: [{ id, path: '/', title: 'Home', seo: saved }] };
        }
        return { rows: [], rowCount: 1 };
    } }));
    const result = await patchPage(context({ seo: { title: 'SEO title', imageId } }));
    assert.deepEqual(saved, { title: 'SEO title', imageId });
    assert.deepEqual(toEditorPage(result).seo, saved);
});
test('page PATCH rejects cross-site media and detail-template SEO', async (t) => {
    let type = 'standard';
    t.mock.method(pool, 'connect', async () => ({ release() {}, async query(sql) {
        if (sql.includes('FOR UPDATE OF s')) return { rows: [{ id }] };
        if (sql.includes('SELECT id, site_id, path, title')) return { rows: [{ id, path: '/about', title: 'About', page_type: type, seo: {} }] };
        assert.doesNotMatch(sql, /UPDATE pages/);
        return { rows: [], rowCount: 0 };
    } }));
    const result = await patchPage(context({ seo: { imageId } }));
    assert.equal(result.status, 400);
    assert.ok(result.value.fields['seo.imageId']);
    type = 'detail';
    assert.equal((await patchPage(context({ seo: {} }))).status, 400);
});
test('fingerprint SQL includes site SEO and the complete pages document including SEO', async () => {
    let query;
    await getSiteFingerprint(id, { query: async (sql) => { query = sql; return { rows: [{ fingerprint: 'digest' }] }; } });
    assert.match(query, /'seo', seo/);
    assert.match(query, /to_jsonb\(t\) - 'created_at'/);
    assert.match(query, /FROM pages t WHERE site_id = \$1/);
    assert.doesNotMatch(query, /- 'seo'/);
});
