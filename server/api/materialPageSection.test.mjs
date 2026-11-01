import assert from 'node:assert/strict';
import test from 'node:test';
import { pool } from '../../db/client.mjs';
import postPage from './postPage.mjs';
import patchPage from './patchPage.mjs';

const siteId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const sectionId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const pageId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

function context(body, page = false) {
    return {
        req: {
            header: (name) => name === 'Host' ? 'materials.localhost' : undefined,
            param: (name) => name === 'pageId' ? pageId : undefined,
            json: async () => body,
        },
        json: (value, status = 200) => ({ value, status }),
    };
}

function emptyResult() { return { rows: [], rowCount: 0 }; }

function conflictsHaveNone(sql) {
    return sql.includes('FROM pages') || sql.includes('FROM redirects');
}

test('creating a material list validates the site section and persists it on the Page', async (t) => {
    const calls = [];
    const client = {
        async query(sql) {
            calls.push(sql);
            if (sql.includes('FOR UPDATE OF s')) return { rows: [{ id: siteId }] };
            if (sql.includes('FROM material_sections')) return { rows: [{ id: sectionId }], rowCount: 1 };
            if (conflictsHaveNone(sql)) return emptyResult();
            if (sql.includes('INSERT INTO pages')) return { rows: [{ id: pageId, materialSectionId: sectionId, dataSource: 'materials' }] };
            return emptyResult();
        },
        release() {},
    };
    t.mock.method(pool, 'connect', async () => client);
    const result = await postPage(context({ title: 'Cases', path: '/cases', type: 'list', dataSource: 'materials', materialSectionId: sectionId }));
    assert.equal(result.status, 201);
    assert.equal(result.value.materialSectionId, sectionId);
    assert.ok(calls.some((sql) => sql.includes('material_section_id')));
});

test('changing a list source validates and returns its same-site material section', async (t) => {
    const client = {
        async query(sql) {
            if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return emptyResult();
            if (sql.includes('FOR UPDATE OF s')) return { rows: [{ id: siteId }] };
            if (sql.includes('SELECT id, site_id, path, title')) return { rows: [{
                id: pageId, site_id: siteId, path: '/cases', title: 'Cases', content: [], page_type: 'list',
                data_source: 'products', material_section_id: null, detail_parent_id: null, route_param: null,
            }] };
            if (sql.includes('FROM material_sections')) return { rows: [{ id: sectionId }], rowCount: 1 };
            if (sql.includes('UPDATE pages')) return { rows: [{
                id: pageId, site_id: siteId, path: '/cases', title: 'Cases', content: [], type: 'list',
                dataSource: 'materials', materialSectionId: sectionId,
            }] };
            if (sql.includes('SELECT id, path, deleted_at')) return { rows: [] };
            if (sql.includes('SELECT id, path FROM pages')) return { rows: [] };
            if (conflictsHaveNone(sql)) return emptyResult();
            return emptyResult();
        },
        release() {},
    };
    t.mock.method(pool, 'connect', async () => client);
    const result = await patchPage(context({ dataSource: 'materials', materialSectionId: sectionId }, true));
    assert.equal(result.materialSectionId, sectionId);
    assert.equal(result.dataSource, 'materials');
});
