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
    t.mock.method(pool, 'query', async (sql, values) => {
        if (sql.includes('UPDATE pages')) {
            assert.equal(values[1], pageId);
            assert.equal(values[2], 'test.localhost');
            saved = JSON.parse(values[0]);
        } else {
            assert.match(sql, /p.deleted_at IS NULL/);
            assert.deepEqual(values, [pageId, 'test.localhost']);
        }
        return { rows: [{ id: pageId, path: '/', title: 'Page', content: structuredClone(saved) }] };
    });
    const result = await putPage(context({ content }));
    assert.deepEqual(result.content, content);
    assert.deepEqual((await getPage(context())).content, content);
    assert.equal(result.content[0].id, undefined);
});

test('rejects missing, unknown and incompatible views before any database operation', async (t) => {
    t.mock.method(pool, 'query', () => { assert.fail('Invalid content must not reach the database'); });
    for (const item of [
        { part: '@kroy/reviews', props: {} },
        { ...content[0], view: { name: '@kroy/missing', props: {} } },
        { ...content[0], view: { name: '@kroy/article-content', props: {} } },
        { ...content[0], id: 'editor-id' },
    ]) {
        const response = await putPage(context({ content: [item] }));
        assert.equal(response.status, 400);
    }
});
