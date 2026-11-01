import assert from 'node:assert/strict';
import test from 'node:test';
import { loadMaterialPreview } from './materialPreview.mjs';

const sections = [{ id: 'section-a', name: 'Cases' }];
const material = { id: 'material-a', sectionId: 'section-a', status: 'published', slug: 'one', title: 'One', summary: '', content: null, coverMediaId: 'cover' };

function mockCommon(t, pages, materials = [material]) {
    t.mock.method(globalThis, 'fetch', async (url) => {
        if (url === '/api/site/material-sections') return Response.json(sections);
        if (url === '/api/site/materials') return Response.json(materials);
        if (url === '/api/pages') return Response.json(pages);
        if (url === '/api/pages/list-a') return Response.json({ dataSource: 'materials', materialSectionId: 'section-a' });
        throw new Error(`Unexpected URL: ${url}`);
    });
}

test('material list preview loads section-scoped published summaries and its own template', async (t) => {
    mockCommon(t, [
        { id: 'list-a', type: 'list', dataSource: 'materials', materialSectionId: 'section-a' },
        { id: 'detail-a', type: 'detail', detailParentId: 'list-a', path: '/cases/:slug', routeParam: 'slug' },
        { id: 'detail-b', type: 'detail', detailParentId: 'list-b', path: '/news/:slug', routeParam: 'slug' },
    ], [material, { ...material, id: 'draft', status: 'draft' }]);
    const preview = await loadMaterialPreview({ id: 'list-a', type: 'list', dataSource: 'materials', materialSectionId: 'section-a' });
    assert.equal(preview.status, 'success');
    assert.deepEqual(preview.materials['section-a'].items, [{ slug: 'one', title: 'One', summary: '', coverUrl: '/api/media/cover', status: 'published' }]);
    assert.deepEqual(preview.materials['section-a'].detailTemplate, { path: '/cases/:slug', routeParam: 'slug' });
});

test('detail preview uses a published record from its parent section', async (t) => {
    mockCommon(t, [{ id: 'list-a', type: 'list', dataSource: 'materials', materialSectionId: 'section-a' }]);
    const preview = await loadMaterialPreview({ type: 'detail', detailParentId: 'list-a' });
    assert.equal(preview.record.slug, 'one');
    assert.equal(preview.record.coverUrl, '/api/media/cover');
});

test('ordinary-page preview exposes all sections to the dynamic picker', async (t) => {
    mockCommon(t, []);
    const preview = await loadMaterialPreview({ type: 'standard' });
    assert.equal(preview.materials['section-a'].items.length, 1);
    assert.equal(preview.status, 'idle');
});
