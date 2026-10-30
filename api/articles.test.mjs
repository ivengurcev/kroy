import assert from 'node:assert/strict';
import test from 'node:test';
import { isPublishableArticle, normalizeArticleInput } from './articles.mjs';

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
    assert.equal(normalizeArticleInput({ slug: 'hello', title: 'Title', status: 'pending' }), null);
    assert.deepEqual(normalizeArticleInput({
        slug: 'hello',
        title: 'Title',
        content: { root: { children: [] } },
        status: 'published',
    }).status, 'published');
});

test('published articles require content', () => {
    assert.equal(isPublishableArticle({ status: 'published', content: null }), false);
    assert.equal(isPublishableArticle({ status: 'published', content: {} }), true);
    assert.equal(isPublishableArticle({ status: 'draft', content: null }), true);
});

test('article patches allow clearing content and cover media', () => {
    assert.deepEqual(normalizeArticleInput({ content: null, coverMediaId: null }, { partial: true }), {
        content: null,
        coverMediaId: null,
    });
});
