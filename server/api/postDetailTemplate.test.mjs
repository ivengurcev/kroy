import assert from 'node:assert/strict';
import test from 'node:test';
import { initialDetailContent } from './postDetailTemplate.mjs';

test('new material detail templates start with the catalogued material part and compatible widget', () => {
    assert.deepEqual(initialDetailContent('materials'), [{
        part: '@kroy/material',
        props: {},
        view: { name: '@kroy/material-content', props: {} },
    }]);
});

test('other sources keep the empty content default', () => {
    assert.deepEqual(initialDetailContent('products'), []);
    assert.deepEqual(initialDetailContent(null), []);
});
