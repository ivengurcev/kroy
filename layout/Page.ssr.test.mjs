import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { randomUUID } from 'node:crypto';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { transform } from 'esbuild';

let Page;
let compiledPath;

before(async () => {
    const sourcePath = fileURLToPath(new URL('./Page.jsx', import.meta.url));
    const source = await readFile(sourcePath, 'utf8');
    const { code } = await transform(source, { loader: 'jsx', format: 'esm', jsx: 'automatic' });
    compiledPath = join(dirname(sourcePath), `.Page-test-${randomUUID()}.mjs`);
    await writeFile(compiledPath, code);
    ({ default: Page } = await import(pathToFileURL(compiledPath).href));
});

after(async () => {
    if (compiledPath) await rm(compiledPath, { force: true });
});

test('passes separate context and record to a legacy part without changing its settings', () => {
    function Part({ title, context, record }) {
        return createElement('output', null, `${title}|${context.params.caseId}|${record.title}`);
    }
    const html = renderToStaticMarkup(createElement(Page, {
        content: [{ part: 'article', props: { title: 'setting' } }],
        parts: { article: Part },
        context: { params: { caseId: 'sample' } },
        record: { title: 'record' },
    }));

    assert.equal(html, '<output>setting|sample|record</output>');
});

test('keeps widget data/options separate from route context and record', () => {
    function Widget({ data, options, context, record }) {
        return createElement('output', null, `${data.title}|${options.layout}|${context.params.entry}|${record.title}`);
    }
    const html = renderToStaticMarkup(createElement(Page, {
        content: [{ part: 'article', props: { title: 'setting' }, view: { name: 'article-view', props: { layout: 'wide' } } }],
        parts: {},
        widgets: { 'article-view': Widget },
        context: { params: { entry: 'story' } },
        record: { title: 'record' },
    }));

    assert.equal(html, '<output>setting|wide|story|record</output>');
});

test('defaults context and record for existing callers', () => {
    function Part({ context, record }) {
        return createElement('output', null, `${context.params ? 'context' : 'missing'}|${record ?? 'empty'}`);
    }
    const html = renderToStaticMarkup(createElement(Page, {
        content: [{ part: 'legacy', props: {} }],
        parts: { legacy: Part },
    }));

    assert.equal(html, '<output>context|empty</output>');
});

test('preserves existing contacts, catalog and review preparation for parts and widgets', () => {
    const contacts = { phone: '+70000000000', socials: [{ title: 'Link', url: '/link' }] };
    const product = { id: 'product', categoryId: 'category', title: 'Product' };
    const review = { id: 'review', text: 'Review' };
    const cases = [
        ['@kroy/hero', { title: 'Hero' }, { title: 'Hero', socials: contacts.socials }],
        ['@kroy/contacts', {}, contacts],
        ['@kroy/product-selection', { productIds: ['product', 'missing'] }, { productIds: ['product', 'missing'], products: [product] }],
        ['@kroy/category-products', { categoryId: 'category' }, { categoryId: 'category', products: [product] }],
        ['@kroy/reviews', { mode: 'manual', reviewIds: ['review'] }, { mode: 'manual', reviewIds: ['review'], reviews: [review] }],
    ];
    for (const [part, props, expected] of cases) {
        for (const widget of [false, true]) {
            let received;
            function Part({ context, record, ...settings }) { received = settings; return null; }
            function Widget({ data }) { received = data; return null; }
            renderToStaticMarkup(createElement(Page, {
                content: [{ part, props, ...(widget ? { view: { name: 'view', props: {} } } : {}) }],
                parts: { [part]: Part }, widgets: { view: Widget }, contacts,
                catalog: { products: [product] }, reviews: [review],
                record: { title: 'Article must not replace other data' },
            }));
            assert.deepEqual(received, expected);
        }
    }
});
