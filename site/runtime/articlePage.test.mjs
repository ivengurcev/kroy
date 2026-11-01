import assert from 'node:assert/strict';
import test, { before, after } from 'node:test';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { build } from 'esbuild';
import { transform } from '@svgr/core';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { serializePagePayload } from '../../build/site/sitePageData.mjs';

let components;
const compiledPath = fileURLToPath(new URL(`.articlePage-test-${randomUUID()}.mjs`, import.meta.url));

before(async () => {
    const result = await build({
        stdin: {
            contents: `export { default as Page } from './site/runtime/Page.jsx';
                export { default as SiteApp } from './site/runtime/SiteApp.jsx';
                export { default as Article } from './site/parts/article/prepareArticle.mjs';
                export { default as ArticleList } from './site/parts/article-list/prepareArticleList.mjs';
                export { default as ArticleCards } from './site/widgets/article-cards/ArticleCards.jsx';
                export { default as ArticleContent } from './site/widgets/article-content/ArticleContent.jsx';
                export { default as EditorWorkspace } from './admin/editor/EditorWorkspace.jsx';`,
            resolveDir: fileURLToPath(new URL('../../', import.meta.url)),
        },
        outfile: compiledPath,
        bundle: true, write: false, packages: 'external', platform: 'node', format: 'esm', jsx: 'automatic',
        loader: { '.module.css': 'local-css' },
        plugins: [{ name: 'svg', setup(builder) {
            builder.onLoad({ filter: /\.svg$/ }, async ({ path }) => ({
                contents: await transform(await readFile(path, 'utf8'), { plugins: ['@svgr/plugin-jsx'] }),
                loader: 'jsx',
            }));
        } }],
    });
    await writeFile(compiledPath, result.outputFiles.find(({ path }) => path.endsWith('.mjs')).contents);
    components = await import(pathToFileURL(compiledPath).href);
});
after(() => rm(compiledPath, { force: true }));

const record = {
    slug: 'published-story', title: 'Published title', summary: 'Summary', coverUrl: '/api/media/cover-id',
    content: { root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text: 'Article body' }] }] } },
};
const context = { params: { caseId: 'published-story' } };
const item = { id: 'part-id', part: '@kroy/article', props: { title: 'Settings title' }, view: { name: '@kroy/article-content', props: {} } };

function pageProps(content = [item]) {
    return { content, parts: { '@kroy/article': components.Article }, widgets: { '@kroy/article-content': components.ArticleContent }, record, context };
}

test('prepares article data for a widget independently from settings, options and context', () => {
    let received;
    function Widget(props) { received = props; return createElement('p', null, props.data.title); }
    const props = pageProps();
    props.widgets = { '@kroy/article-content': Widget };
    assert.match(renderToString(createElement(components.Page, props)), /Published title/);
    assert.equal(received.context, context);
    assert.equal(received.options, item.view.props);
    assert.equal(received.data.title, 'Published title');
    assert.equal(received.data.content, record.content);
    assert.equal(received.data.coverUrl, '/api/media/cover-id');
    assert.equal(received.data.context, undefined);
    assert.equal(received.data.params, undefined);
    assert.equal(item.props.title, 'Settings title');
});

test('ArticleContent renders data even when record disagrees', () => {
    const html = renderToString(createElement(components.ArticleContent, { data: record, record: { title: 'Wrong record' } }));
    assert.match(html, /Published title/);
    assert.match(html, /Article body/);
    assert.doesNotMatch(html, /Wrong record/);
});

test('article renders its selected widget with matching hydration payload markup', () => {
    const content = [item];
    const initialPage = { path: '/cases/published-story', title: record.title, content, record, context };
    const props = { ...pageProps(content), pages: {}, path: initialPage.path, initialPage };
    const html = renderToString(createElement(components.SiteApp, props));
    assert.match(html, /Published title/);
    assert.match(html, /Article body/);
    assert.match(html, /src="\/api\/media\/cover-id"/);
    assert.equal(renderToString(createElement(components.SiteApp, {
        ...props, initialPage: JSON.parse(serializePagePayload(initialPage)),
    })), html);
});

test('workspace forwards the sample record and named route context to every part and widget', () => {
    function Probe({ data, context }) { return createElement('output', null, `${context.params.caseId}|${data.title}`); }
    const content = [item, { id: 'other', part: '@kroy/other', props: {}, view: item.view }];
    const snapshot = JSON.stringify(content);
    const html = renderToString(createElement(components.EditorWorkspace, {
        ...pageProps(content), parts: { '@kroy/article': components.Article, '@kroy/other': ({ record, context }) => { assert.equal(context.params.caseId, 'published-story'); return record; } }, widgets: { '@kroy/article-content': Probe },
        metadata: {}, widgetMetadata: {}, loadStatus: 'success',
        page: { type: 'detail', routeParam: 'caseId' }, preview: { status: 'success', record },
    }));
    assert.equal((html.match(/published-story\|Published title/g) ?? []).length, 2);
    assert.equal(JSON.stringify(content), snapshot);
});

test('workspace explains missing published articles and preview loading failures', () => {
    for (const [status, message] of [['empty', /Нет опубликованных статей/], ['error', /Не удалось загрузить статью/], ['loading', /Загрузка статьи/]]) {
        const html = renderToString(createElement(components.EditorWorkspace, {
            ...pageProps(), record: null, metadata: {}, widgetMetadata: {}, loadStatus: 'success',
            page: { type: 'detail', routeParam: 'caseId' }, preview: { status, record: null },
        }));
        assert.match(html, message);
    }
});

test('workspace renders article-list preview sources separately from saved content and keeps its empty state', () => {
    const content = [{ id: 'list-part', part: '@kroy/article-list', props: {}, view: { name: '@kroy/article-cards', props: {} } }];
    const snapshot = JSON.stringify(content);
    const props = {
        content, parts: { '@kroy/article-list': components.ArticleList }, widgets: { '@kroy/article-cards': components.ArticleCards },
        metadata: {}, widgetMetadata: {}, loadStatus: 'success', page: { type: 'list', dataSource: 'articles' },
    };
    const articles = {
        items: [{ slug: 'sample', title: 'Published list sample', summary: '', coverUrl: '/api/media/cover-id', status: 'published' }],
        detailTemplate: { path: '/news/:articleId', routeParam: 'articleId' },
    };
    const html = renderToString(createElement(components.EditorWorkspace, { ...props, preview: { status: 'success', articles } }));
    assert.match(html, /Published list sample/);
    assert.match(html, /href="\/news\/sample"/);
    assert.match(html, /src="\/api\/media\/cover-id"/);
    assert.equal(JSON.stringify(content), snapshot);
    assert.match(renderToString(createElement(components.EditorWorkspace, {
        ...props, preview: { status: 'empty', articles: { items: [], detailTemplate: null } },
    })), /Опубликованных статей пока нет/);
});
