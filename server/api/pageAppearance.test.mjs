import assert from 'node:assert/strict';
import test from 'node:test';
import { pool } from '../../db/client.mjs';
import patchPage from './patchPage.mjs';
import getPage from './getPage.mjs';

const pageId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const siteId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const original = {
    id: pageId, site_id: siteId, path: '/', title: 'Home', content: [], page_type: 'standard',
    seo: { description: 'SEO stays' }, appearance: { overrides: { shared: { '--site-font-size-base': '18px' } } },
};
const context = (body) => ({
    req: { header: () => 'appearance.localhost', param: () => pageId, query: () => undefined, json: async () => body },
    json: (value, status = 200) => ({ value, status }),
});

function mockClient(t, { found = true } = {}) {
    let updated;
    const client = { release() {}, async query(sql, params) {
        if (sql.includes('FOR UPDATE OF s')) {
            assert.match(sql, /d.hostname = \$1/);
            return { rows: [{ id: siteId, theme_id: 'calm', theme_mode: 'system', theme_overrides: {} }] };
        }
        if (sql.includes('SELECT id, site_id, path, title')) {
            assert.deepEqual(params, [pageId, siteId]);
            return { rows: found ? [original] : [] };
        }
        if (sql.includes('UPDATE pages')) {
            assert.match(sql, /appearance = \$8::jsonb/);
            updated = { ...original, title: params[1], seo: JSON.parse(params[6]), appearance: JSON.parse(params[7]) };
            return { rows: [updated] };
        }
        return { rows: [] };
    } };
    t.mock.method(pool, 'connect', async () => client);
    return () => updated;
}

test('page appearance PATCH saves only overrides and preserves SEO; unrelated PATCH preserves appearance', async (t) => {
    const update = mockClient(t);
    const appearance = { themeMode: 'dark', overrides: { light: { '--site-color-bg': '#abcdef' } } };
    const saved = await patchPage(context({ appearance }));
    assert.deepEqual(saved.appearance, appearance);
    assert.deepEqual(saved.seo, original.seo);
    assert.equal(saved.theme.mode, 'dark');
    assert.equal(saved.theme.light['--site-color-bg'], '#abcdef');
    assert.deepEqual((await patchPage(context({ title: 'Changed' }))).appearance, original.appearance);
    assert.deepEqual((await patchPage(context({ seo: { description: 'Changed SEO' } }))).appearance, original.appearance);
    assert.deepEqual((await patchPage(context({ appearance: {} }))).appearance, {});
    assert.ok(update());
});

test('invalid page appearance returns 400 without updating; foreign pages remain inaccessible', async (t) => {
    const update = mockClient(t);
    assert.equal((await patchPage(context({ appearance: { overrides: { light: { '--bad': '#abcdef' } } } }))).status, 400);
    assert.equal(update(), undefined);
    mockClient(t, { found: false });
    assert.equal((await patchPage(context({ appearance: {} }))).status, 404);
});

test('page read selects appearance within the existing domain boundary', async (t) => {
    t.mock.method(pool, 'query', async (sql, params) => {
        assert.match(sql, /p.appearance/);
        assert.match(sql, /d.hostname = \$2/);
        assert.deepEqual(params, [pageId, 'appearance.localhost']);
        return { rows: [original] };
    });
    assert.deepEqual((await getPage(context())).appearance, original.appearance);
});
