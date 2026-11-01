import assert from 'node:assert/strict';
import test from 'node:test';
import { assertArticlePathsAvailable, createArticlePages } from './createArticlePages.mjs';

function article(overrides = {}) {
    return {
        slug: 'example-article',
        title: 'Example article',
        summary: 'Summary',
        content: { root: { type: 'root', children: [{ type: 'paragraph', children: [] }] } },
        coverUrl: '/assets/articles/cover.webp',
        ...overrides,
    };
}

test('expands each article through the configured final route parameter', () => {
    const content = [{ part: '@kroy/article', props: {}, view: { name: '@kroy/article-content', props: {} } }];
    const inputArticle = article();
    const pages = createArticlePages([
        { path: '/cases/:caseId', route_param: 'caseId', content },
        { path: '/journal/:entry', route_param: 'entry', content },
    ], [inputArticle]);

    assert.deepEqual(pages.map(({ path, context }) => [path, context.params]), [
        ['/cases/example-article', { caseId: 'example-article' }],
        ['/journal/example-article', { entry: 'example-article' }],
    ]);
    assert.equal(pages[0].title, 'Example article');
    assert.equal(pages[0].record.content, inputArticle.content);
    assert.equal(pages[0].content, content);
    assert.notEqual(pages[0].record.content, pages[0].content);
});

test('supports a root-level detail template and no matching articles', () => {
    assert.equal(createArticlePages([
        { path: '/:slug', route_param: 'slug', content: [] },
    ], [article()])[0].path, '/example-article');
    assert.deepEqual(createArticlePages([
        { path: '/cases/:slug', route_param: 'slug', content: [] },
    ], []), []);
});

test('rejects invalid template route, mismatched parameter, and article slug', () => {
    const valid = { path: '/cases/:slug', route_param: 'slug', content: [] };
    assert.throws(() => createArticlePages([{ ...valid, path: '/cases/:slug/more' }], [article()]));
    assert.throws(() => createArticlePages([{ ...valid, route_param: 'id' }], [article()]));
    assert.throws(() => createArticlePages([valid], [article({ slug: '../unsafe' })]));
});

test('keeps existing empty template content empty during expansion', () => {
    const emptyTemplate = { path: '/cases/:slug', route_param: 'slug', content: [] };
    const pages = createArticlePages([emptyTemplate], [article()]);
    assert.deepEqual(pages[0].content, []);
    assert.deepEqual(emptyTemplate.content, []);
});

test('rejects collisions with existing paths and duplicate generated paths', () => {
    const page = { path: '/cases/example-article' };
    assert.throws(() => assertArticlePathsAvailable([page], ['/cases/example-article']), /collision/i);
    assert.throws(() => assertArticlePathsAvailable([page], ['/cases/:slug']), /collision/i);
    assert.throws(() => assertArticlePathsAvailable([page], ['/cases/example-article']), /collision/i);
    assert.throws(() => assertArticlePathsAvailable([page, page], []), /collision/i);
    assert.doesNotThrow(() => assertArticlePathsAvailable([page], ['/cases']));
});
