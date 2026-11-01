import assert from 'node:assert/strict';
import test from 'node:test';
import { isPublishableMaterial, normalizeMaterialInput } from './materials.mjs';

test('material input requires a section and valid material fields', () => {
    assert.equal(normalizeMaterialInput({ slug: 'case', title: 'Case' }), null);
    assert.deepEqual(normalizeMaterialInput({ sectionId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', slug: 'case', title: 'Case' }), {
        sectionId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', slug: 'case', title: 'Case', summary: '', content: null, coverMediaId: null, status: 'draft',
    });
    assert.equal(normalizeMaterialInput({ sectionId: 'bad', slug: 'case', title: 'Case' }), null);
});

test('material patches permit section moves and clearing optional values', () => {
    assert.deepEqual(normalizeMaterialInput({ sectionId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', content: null, coverMediaId: null }, { partial: true }), {
        sectionId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', content: null, coverMediaId: null,
    });
});

test('published materials require non-empty Lexical text', () => {
    assert.equal(isPublishableMaterial({ status: 'published', content: null }), false);
    assert.equal(isPublishableMaterial({ status: 'published', content: { root: { type: 'root', children: [] } } }), false);
    assert.equal(isPublishableMaterial({ status: 'published', content: { root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text: 'Text' }] }] } } }), true);
});
