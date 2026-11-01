import assert from 'node:assert/strict';
import test from 'node:test';
import { createClientPageRegistry, serializePagePayload } from './sitePageData.mjs';

test('keeps dynamic material records out of the shared client page registry', () => {
    const pages = [
        { path: '/', title: 'Home', content: [] },
        { path: '/cases/example', title: 'Material sentinel', content: [], record: { title: 'Material sentinel' } },
    ];

    assert.deepEqual(createClientPageRegistry(pages), {
        '/': { path: '/', title: 'Home', content: [] },
    });
});

test('serializes only the current page payload and escapes script terminators', () => {
    const currentPage = {
        path: '/cases/example',
        title: '</script><script>alert(1)</script>',
        content: [],
        context: { params: { caseId: 'example' } },
        record: { title: 'Current material sentinel', content: null },
    };
    const payload = serializePagePayload(currentPage);

    assert.doesNotMatch(payload, /<\//);
    assert.deepEqual(JSON.parse(payload), currentPage);
    assert.doesNotMatch(payload, /Unrelated material sentinel/);
});

test('keeps per-section material-list data with its page in the client registry', () => {
    const materials = { section: { items: [{ slug: 'example', title: 'Material', summary: 'Summary', coverUrl: null, status: 'published' }], detailTemplate: { path: '/news/:slug', routeParam: 'slug' } } };
    const pages = [{ path: '/', title: 'Home', content: [] }, { path: '/news', title: 'News', content: [], materials, materialSectionId: 'section' }];
    const registry = createClientPageRegistry(pages);
    assert.deepEqual(registry['/news'].materials, materials);
    assert.equal(registry['/'].materials, undefined);
    assert.equal(registry['/news'].materialSectionId, 'section');
    assert.deepEqual(JSON.parse(serializePagePayload(registry['/news'])).materials, materials);
});
