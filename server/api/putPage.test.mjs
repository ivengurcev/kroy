import assert from 'node:assert/strict';
import test from 'node:test';
import { pool } from '../../db/client.mjs';
import putPage from './putPage.mjs';
import getPage from './getPage.mjs';

const pageId = '11111111-1111-4111-8111-111111111111';
const content = [{ part: '@kroy/reviews', props: { reviewIds: ['second', 'first'], mode: 'manual' }, view: { name: '@kroy/review-cards', props: { columns: 4 } } }];
function context(body) {
    return {
        req: {
            param(name) { return name === 'pageId' ? pageId : undefined; },
            query() { return undefined; },
            header(name) { return name === 'Host' ? 'test.localhost' : undefined; },
            async json() { return body; },
        },
        json(value, status = 200) { return { value, status }; },
    };
}

test('saves and loads the exact data settings and selected widget without editor state', async (t) => {
    let saved;
    const client = {
        async query(sql, values) {
            if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] };
            if (sql.includes('JOIN domains')) return { rows: [{ site_id: 'site-id', page_type: 'standard', data_source: null }] };
            if (sql.includes('UPDATE pages')) {
                saved = JSON.parse(values[0]);
                return { rows: [{ id: pageId, site_id: 'site-id', path: '/', title: 'Page', content: structuredClone(saved) }] };
            }
            assert.fail(`Unexpected page update query: ${sql}`);
        },
        release() {},
    };
    t.mock.method(pool, 'connect', async () => client);
    t.mock.method(pool, 'query', async (sql, values) => {
        assert.match(sql, /p.deleted_at IS NULL/);
        assert.deepEqual(values, [pageId, 'test.localhost']);
        return { rows: [{ id: pageId, path: '/', title: 'Page', content: structuredClone(saved) }] };
    });
    const result = await putPage(context({ content }));
    assert.deepEqual(result.content, content);
    assert.deepEqual((await getPage(context())).content, content);
    assert.equal(result.content[0].id, undefined);
});

test('material-list blocks require a selected same-site section on ordinary Pages', async (t) => {
    const sectionId = '22222222-2222-4222-8222-222222222222';
    const block = { part: '@kroy/material-list', props: { sectionId }, view: { name: '@kroy/material-cards', props: {} } };
    const queries = [];
    const client = {
        async query(sql, values) {
            queries.push(sql);
            if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] };
            if (sql.includes('JOIN domains')) return { rows: [{ site_id: 'site-id', page_type: 'standard', data_source: null }] };
            if (sql.includes('FROM material_sections')) return { rows: values[1].includes(sectionId) ? [{ id: sectionId }] : [] };
            if (sql.includes('UPDATE pages')) return { rows: [{ id: pageId, content: [block] }] };
            assert.fail(`Unexpected page update query: ${sql}`);
        },
        release() {},
    };
    t.mock.method(pool, 'connect', async () => client);
    const result = await putPage(context({ content: [block] }));
    assert.deepEqual(result.content, [block]);
    assert.ok(queries.some((sql) => sql.includes('FOR KEY SHARE')));

    const foreignBlock = { ...block, props: { sectionId: '33333333-3333-4333-8333-333333333333' } };
    t.mock.method(pool, 'connect', async () => ({
        async query(sql, values) {
            if (sql.includes('JOIN domains')) return { rows: [{ site_id: 'site-id', page_type: 'standard', data_source: null }] };
            if (sql.includes('FROM material_sections')) return { rows: [] };
            return { rows: [] };
        }, release() {},
    }));
    const rejected = await putPage(context({ content: [foreignBlock] }));
    assert.equal(rejected.status, 400);
    assert.equal(rejected.value.error, 'Invalid material section');
});

test('rejects missing, unknown and incompatible views before any database operation', async (t) => {
    t.mock.method(pool, 'query', () => { assert.fail('Invalid content must not reach the database'); });
    for (const item of [
        { part: '@kroy/reviews', props: {} },
        { ...content[0], view: { name: '@kroy/missing', props: {} } },
        { ...content[0], view: { name: '@kroy/material-content', props: {} } },
        { ...content[0], id: 'editor-id' },
    ]) {
        const response = await putPage(context({ content: [item] }));
        assert.equal(response.status, 400);
    }
});
