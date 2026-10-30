import assert from 'node:assert/strict';
import test from 'node:test';
import { isDetailTemplatePath } from './previewPaths.mjs';

test('preview recognizes concrete paths handled by detail templates', () => {
    const templates = [{ path: '/cases/:slug' }, { path: '/articles/:articleId' }];

    assert.equal(isDetailTemplatePath('/cases/example', templates), true);
    assert.equal(isDetailTemplatePath('/articles/hello', templates), true);
    assert.equal(isDetailTemplatePath('/cases', templates), false);
    assert.equal(isDetailTemplatePath('/other/example', templates), false);
});
