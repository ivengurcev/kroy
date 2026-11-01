import assert from 'node:assert/strict';
import test from 'node:test';
import { toEditorPage } from './pageDetails.mjs';

test('editor keeps detail template settings from a loaded page and PATCH response', () => {
    const loadedPage = toEditorPage({
        id: 'page-id',
        title: 'Case details',
        path: '/cases/:caseSlug',
        type: 'detail',
        dataSource: null,
        materialSectionId: null,
        routeParam: 'caseSlug',
        detailParentId: 'parent-id',
    });
    const patchedPage = toEditorPage({
        ...loadedPage,
        title: 'Case view',
        path: '/cases/:caseId',
        routeParam: 'caseId',
    });

    assert.deepEqual(loadedPage, {
        id: 'page-id',
        title: 'Case details',
        path: '/cases/:caseSlug',
        type: 'detail',
        dataSource: null,
        materialSectionId: null,
        routeParam: 'caseSlug',
        detailParentId: 'parent-id',
    });
    assert.equal(patchedPage.type, 'detail');
    assert.equal(patchedPage.routeParam, 'caseId');
    assert.equal(patchedPage.path, '/cases/:caseId');
});
