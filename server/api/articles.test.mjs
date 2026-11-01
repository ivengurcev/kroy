import assert from 'node:assert/strict';
import test from 'node:test';
import { isEditorState, isPublishableArticle, normalizeArticleInput } from './articles.mjs';

test('article input accepts a draft with nullable Lexical content', () => {
    assert.deepEqual(normalizeArticleInput({
        slug: 'hello-world',
        title: 'Hello world',
    }), {
        slug: 'hello-world',
        title: 'Hello world',
        summary: '',
        content: null,
        coverMediaId: null,
        status: 'draft',
    });
});

test('article input validates slugs, content objects and statuses', () => {
    assert.equal(normalizeArticleInput({ slug: 'Hello world', title: 'Title' }), null);
    assert.equal(normalizeArticleInput({ slug: 'hello', title: 'Title', content: [] }), null);
    assert.equal(normalizeArticleInput({ slug: 'hello', title: 'Title', content: {} }), null);
    assert.equal(normalizeArticleInput({ slug: 'hello', title: 'Title', status: 'pending' }), null);
    assert.deepEqual(normalizeArticleInput({
        slug: 'hello',
        title: 'Title',
        content: { root: { type: 'root', children: [] } },
        status: 'published',
    }).status, 'published');
});

test('published articles require content', () => {
    assert.equal(isPublishableArticle({ status: 'published', content: null }), false);
    assert.equal(isPublishableArticle({ status: 'published', content: { root: { type: 'root', children: [] } } }), false);
    assert.equal(isPublishableArticle({
        status: 'published',
        content: {
            root: {
                type: 'root',
                children: [{ type: 'paragraph', children: [{ type: 'text', text: 'Nested text' }] }],
            },
        },
    }), true);
    assert.equal(isPublishableArticle({
        status: 'published',
        content: {
            root: {
                type: 'root',
                children: [{ type: 'paragraph', children: [{ type: 'text', text: '   ' }] }],
            },
        },
    }), false);
    assert.equal(isPublishableArticle({ status: 'draft', content: null }), true);
});

test('Lexical EditorState structure is validated recursively', () => {
    assert.equal(isEditorState({ root: { type: 'root', children: [] } }), true);
    assert.equal(isEditorState({ root: { type: 'root', children: [{ type: 'paragraph', children: [{}] }] } }), false);
    assert.equal(isEditorState({ root: { type: 'root', children: [{ type: 'text', text: 'bad', children: [] }] } }), false);
    assert.equal(isEditorState({ root: { type: 'root', children: [{ type: 'text', text: 'ok' }] } }), true);
});

test('article patches allow clearing content and cover media', () => {
    assert.deepEqual(normalizeArticleInput({ content: null, coverMediaId: null }, { partial: true }), {
        content: null,
        coverMediaId: null,
    });
});
