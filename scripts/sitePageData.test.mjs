import assert from 'node:assert/strict';
import test from 'node:test';
import { createClientPageRegistry, serializePagePayload } from './sitePageData.mjs';

test('keeps dynamic article records out of the shared client page registry', () => {
    const pages = [
        { path: '/', title: 'Home', content: [] },
        { path: '/cases/example', title: 'Article sentinel', content: [], record: { title: 'Article sentinel' } },
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
        record: { title: 'Current article sentinel', content: null },
    };
    const payload = serializePagePayload(currentPage);

    assert.doesNotMatch(payload, /<\//);
    assert.deepEqual(JSON.parse(payload), currentPage);
    assert.doesNotMatch(payload, /Unrelated article sentinel/);
});
