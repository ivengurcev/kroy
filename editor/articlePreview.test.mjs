import assert from 'node:assert/strict';
import test from 'node:test';
import { loadArticlePreview } from './articlePreview.mjs';

const page = { type: 'detail', detailParentId: 'parent-id', routeParam: 'caseId', content: [] };
const published = { id: 'article-id', status: 'published', slug: 'sample', title: 'Published', summary: '', content: null, coverMediaId: 'cover-id' };

function mockApi(t, parent, articles) {
    const controller = new AbortController();
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        assert.equal(options.signal, controller.signal);
        if (url === '/api/pages/parent-id') return Response.json(parent);
        assert.equal(url, '/api/site/articles');
        return Response.json(articles);
    });
    return controller.signal;
}

test('loads a published sample from the article parent using the existing media URL', async (t) => {
    const signal = mockApi(t, { dataSource: 'articles' }, [{ ...published, status: 'draft', title: 'Draft' }, published]);
    const snapshot = JSON.stringify(page);
    const preview = await loadArticlePreview(page, signal);
    assert.equal(preview.status, 'success');
    assert.deepEqual(preview.record, { slug: 'sample', title: 'Published', summary: '', content: null, coverUrl: '/api/media/cover-id' });
    assert.equal(JSON.stringify(page), snapshot);
});

test('returns empty for a site with no articles or drafts only', async (t) => {
    for (const articles of [[], [{ ...published, status: 'draft' }]]) {
        const signal = mockApi(t, { dataSource: 'articles' }, articles);
        assert.deepEqual(await loadArticlePreview(page, signal), { status: 'empty', record: null });
    }
});

test('does not request articles for other detail sources or standard pages', async (t) => {
    const signal = mockApi(t, { dataSource: 'products' }, null);
    assert.deepEqual(await loadArticlePreview(page, signal), { status: 'idle', record: null });
    assert.deepEqual(await loadArticlePreview({ type: 'standard' }, signal), { status: 'idle', record: null });
});

test('handles an article without a cover', async (t) => {
    const signal = mockApi(t, { dataSource: 'articles' }, [{ ...published, coverMediaId: null }]);
    assert.equal((await loadArticlePreview(page, signal)).record.coverUrl, null);
});

test('propagates API failures and aborts instead of treating them as an empty site', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 500 }));
    await assert.rejects(loadArticlePreview(page), /Не удалось/);
    t.mock.method(globalThis, 'fetch', async () => { throw new DOMException('Aborted', 'AbortError'); });
    await assert.rejects(loadArticlePreview(page), { name: 'AbortError' });
});

test('loads published list previews with media URLs and a template linked to this list only', async (t) => {
    const list = { id: 'news-id', type: 'list', dataSource: 'articles', content: [] };
    const snapshot = JSON.stringify(list);
    t.mock.method(globalThis, 'fetch', async (url) => {
        if (url === '/api/site/articles') return Response.json([{ ...published, status: 'draft', slug: 'draft' }, published]);
        assert.equal(url, '/api/pages');
        return Response.json([
            { type: 'detail', detailParentId: 'other-list', path: '/other/:slug', routeParam: 'slug' },
            { type: 'detail', detailParentId: 'news-id', path: '/news/:articleId', routeParam: 'articleId' },
        ]);
    });
    const result = await loadArticlePreview(list);
    assert.equal(result.status, 'success');
    assert.deepEqual(result.articles.items, [{ slug: 'sample', title: 'Published', summary: '', coverUrl: '/api/media/cover-id', status: 'published' }]);
    assert.deepEqual(result.articles.detailTemplate, { path: '/news/:articleId', routeParam: 'articleId' });
    assert.equal(JSON.stringify(list), snapshot);
});

test('list previews support no template and no published articles without falling back to a fake route', async (t) => {
    t.mock.method(globalThis, 'fetch', async (url) => Response.json(url === '/api/pages' ? [] : [{ ...published, status: 'draft' }]));
    const result = await loadArticlePreview({ id: 'news-id', type: 'list', dataSource: 'articles' });
    assert.equal(result.status, 'empty');
    assert.deepEqual(result.articles, { items: [], detailTemplate: null });
});
