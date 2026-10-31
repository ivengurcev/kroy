import assert from 'node:assert/strict';
import test from 'node:test';
import { initialDetailContent } from './postDetailTemplate.mjs';

test('new article detail templates start with the catalogued article part and compatible widget', () => {
    assert.deepEqual(initialDetailContent('articles'), [{
        part: '@kroy/article',
        props: {},
        view: { name: '@kroy/article-content', props: {} },
    }]);
});

test('other sources keep the empty content default', () => {
    assert.deepEqual(initialDetailContent('products'), []);
    assert.deepEqual(initialDetailContent(null), []);
});
