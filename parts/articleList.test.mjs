import assert from 'node:assert/strict';
import test from 'node:test';
import prepareArticleList from './article-list/prepareArticleList.mjs';
import { createArticleListData } from '../layout/articleListData.mjs';

const published = { slug: 'example', title: 'Article', summary: 'Summary', coverUrl: '/cover.webp', status: 'published', content: { secret: 'Full text must stay out of lists' } };
const draft = { ...published, slug: 'draft', status: 'draft' };

test('article list source contains only published summaries and the part produces only public card fields', () => {
    const articles = createArticleListData([draft, published], { path: '/news/:articleId', routeParam: 'articleId' });
    assert.equal(articles.items.length, 1);
    assert.equal(JSON.stringify(articles).includes('secret'), false);
    const result = prepareArticleList({ articles });
    assert.deepEqual(result, [{ slug: 'example', title: 'Article', summary: 'Summary', coverUrl: '/cover.webp', href: '/news/example' }]);
    assert.equal(prepareArticleList({ articles: { ...articles, items: [draft] } }).length, 0);
});

test('uses the linked template and its named parameter, including root-level details', () => {
    for (const [path, routeParam, href] of [
        ['/articles/:slug', 'slug', '/articles/example'],
        ['/news/:articleId', 'articleId', '/news/example'],
        ['/:entry', 'entry', '/example'],
    ]) assert.equal(prepareArticleList({ articles: createArticleListData([published], { path, routeParam }) })[0].href, href);
});

test('keeps articles without inventing detail links when there is no template', () => {
    const result = prepareArticleList({ articles: createArticleListData([{ ...published, coverUrl: null }], null) });
    assert.equal(result[0].href, null);
    assert.equal(result[0].coverUrl, null);
});

test('supports sites with no published articles and does not change input settings or articles', () => {
    const input = { props: {}, articles: createArticleListData([draft], null) };
    const snapshot = JSON.stringify(input);
    assert.deepEqual(prepareArticleList(input), []);
    assert.equal(JSON.stringify(input), snapshot);
    assert.deepEqual(prepareArticleList({}), []);
});

test('attaches summaries only to article lists and selects each list own detail template', async () => {
    const { attachArticleLists } = await import('../layout/articleListData.mjs');
    const pages = [
        { id: 'home', path: '/', type: 'standard', content: [] },
        { id: 'news', path: '/news', type: 'list', dataSource: 'articles', content: [] },
        { id: 'journal', path: '/journal', type: 'list', dataSource: 'articles', content: [] },
        { id: 'empty-template', path: '/read', type: 'list', dataSource: 'articles', content: [] },
    ];
    const templates = [
        { detailParentId: 'news', path: '/news/:articleId', routeParam: 'articleId' },
        { detailParentId: 'journal', path: '/journal/:entry', routeParam: 'entry' },
    ];
    const result = attachArticleLists(pages, [published, draft], templates);
    assert.equal(result[0], pages[0]);
    assert.equal(result[0].articles, undefined);
    assert.equal(prepareArticleList({ articles: result[1].articles })[0].href, '/news/example');
    assert.equal(prepareArticleList({ articles: result[2].articles })[0].href, '/journal/example');
    assert.equal(prepareArticleList({ articles: result[3].articles })[0].href, null);
    assert.equal(JSON.stringify(result).includes('Full text'), false);
});
