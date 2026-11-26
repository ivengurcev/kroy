import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { build } from 'esbuild';
import { randomUUID } from 'node:crypto';
import { rm, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { discoverParts, discoverWidgets, validateDefaultWidgets } from '../../build/registry/discoverParts.mjs';
import prepareMaterialList from '../parts/material-list/prepareMaterialList.mjs';
import prepareReviews from '../parts/reviews/prepareReviews.mjs';

const outputs = [];
let server;
let widgets;
let parts;

before(async () => {
    [parts, widgets] = await Promise.all([discoverParts(), discoverWidgets()]);
    const imports = [];
    const entries = [];
    const partImports = [];
    const partEntries = [];
    widgets.forEach((widget, index) => {
        imports.push(`import Widget${index} from ${JSON.stringify(widget.componentPath)};`);
        entries.push(`${JSON.stringify(widget.name)}: Widget${index}`);
    });
    parts.forEach((part, index) => {
        partImports.push(`import Part${index} from ${JSON.stringify(part.componentPath)};`);
        partEntries.push(`${JSON.stringify(part.name)}: Part${index}`);
    });
    const contents = [...imports, ...partImports,
        `export const widgets = {${entries.join(',')}};`,
        `export const parts = {${partEntries.join(',')}};`,
        "export { default as Page } from './site/runtime/Page.jsx';",
        "export { default as SiteRoot } from './site/runtime/SiteRoot.jsx';"].join('\n');
    const outfile = fileURLToPath(new URL(`.carousel-${randomUUID()}.mjs`, import.meta.url));
    outputs.push(outfile);
    const result = await build({
        stdin: { contents, resolveDir: fileURLToPath(new URL('../../', import.meta.url)) },
        outfile, bundle: true, write: false, packages: 'external', platform: 'node', format: 'esm',
        jsx: 'automatic', loader: { '.module.css': 'local-css', '.png': 'dataurl', '.ttf': 'dataurl' },
    });
    await writeFile(outfile, result.outputFiles.find(({ path }) => path === outfile).contents);
    server = await import(pathToFileURL(outfile).href);
});

after(() => Promise.all(outputs.map((path) => rm(path, { force: true }))));

const materialItems = [
    { slug: 'first', title: 'Первый материал', summary: 'Короткое описание', coverUrl: '/first.webp', status: 'published' },
    { slug: 'second', title: 'Второй материал', summary: '', coverUrl: '/second.webp', status: 'published' },
    { slug: 'draft', title: 'Черновик', summary: '', coverUrl: '', status: 'draft' },
];
const materialData = prepareMaterialList({
    props: { sectionId: 'news' },
    materials: { news: { detailTemplate: { path: '/news/:slug', routeParam: 'slug' }, items: materialItems } },
});
const reviews = [
    { id: 'one', authorName: 'Анна', authorSubtitle: 'Клиент', text: 'Первый отзыв', reviewDate: '2026-02-03', mediaUrl: '/one.webp' },
    { id: 'two', authorName: 'Борис', text: 'Второй отзыв', reviewDate: '2026-03-04' },
];
const reviewData = prepareReviews({ props: { title: 'Отзывы клиентов', mode: 'auto', limit: 0 }, reviews });

test('new carousel widgets are discoverable alternatives with the existing contracts and defaults intact', () => {
    assert.doesNotThrow(() => validateDefaultWidgets(parts, widgets));
    for (const [name, contract, title] of [
        ['@kroy/material-carousel', 'materials-list', 'Карусель материалов'],
        ['@kroy/review-carousel', 'reviews', 'Карусель отзывов'],
    ]) {
        const widget = widgets.find((entry) => entry.name === name);
        assert.ok(widget, name);
        assert.equal(widget.contract, contract);
        assert.equal(widget.title, title);
        assert.deepEqual(widget.fields, {});
    }
    assert.equal(parts.find(({ name }) => name === '@kroy/material-list').defaultWidget, '@kroy/material-cards');
    assert.equal(parts.find(({ name }) => name === '@kroy/reviews').defaultWidget, '@kroy/reviews-slider');
});

test('material carousel keeps the prepared material set, links and empty state on the server', () => {
    const Carousel = server.widgets['@kroy/material-carousel'];
    const html = renderToString(createElement(Carousel, { data: materialData }));
    assert.match(html, /role="group" aria-label="Материалы" data-count="2"/);
    assert.match(html, /Первый материал/);
    assert.match(html, /Второй материал/);
    assert.doesNotMatch(html, /Черновик/);
    assert.match(html, /href="\/news\/first"/);
    assert.match(html, /href="\/news\/second"/);
    assert.match(html, /Короткое описание/);
    assert.equal((html.match(/data-card-carousel-item=""/g) ?? []).length, 2);
    assert.match(html, /Чтобы увидеть остальные карточки/);
    assert.doesNotMatch(html, /Следующая карточка|aria-live/);

    const withoutTemplate = prepareMaterialList({ props: { sectionId: 'news' }, materials: { news: { items: materialItems } } });
    const unlinked = renderToString(createElement(Carousel, { data: withoutTemplate }));
    assert.match(unlinked, /Первый материал/);
    assert.doesNotMatch(unlinked, /<a\b|>Читать</);

    const empty = renderToString(createElement(Carousel, { data: [] }));
    assert.match(empty, /Опубликованных материалов пока нет\./);
    assert.match(empty, /role="status"/);
    assert.doesNotMatch(empty, /data-card-carousel-item/);
});

test('review carousel reuses review cards, shared form and button, including the empty CTA state', () => {
    const Carousel = server.widgets['@kroy/review-carousel'];
    const html = renderToString(createElement(Carousel, { data: { ...reviewData, showSubmitButton: true } }));
    assert.match(html, /<h2[^>]*>Отзывы клиентов<\/h2>/);
    assert.match(html, /role="group" aria-label="Отзывы клиентов" data-count="2"/);
    assert.match(html, /Первый отзыв/);
    assert.match(html, /Второй отзыв/);
    assert.match(html, /Анна/);
    assert.match(html, /src="\/one\.webp"/);
    assert.match(html, /Оставить отзыв/);
    assert.match(html, /<dialog/);
    assert.doesNotMatch(html, /Все отзывы/);

    const empty = renderToString(createElement(Carousel, { data: { title: 'Отзывы', reviews: [], showSubmitButton: false } }));
    assert.equal(empty, '');
    const emptyCta = renderToString(createElement(Carousel, { data: { title: 'Отзывы', reviews: [], showSubmitButton: true } }));
    assert.match(emptyCta, /<h2[^>]*>Отзывы<\/h2>/);
    assert.match(emptyCta, /Оставить отзыв/);
    assert.match(emptyCta, /<dialog/);
    assert.doesNotMatch(emptyCta, /data-card-carousel-item/);
});

test('duplicate selected review ids render unique keys without React warnings', () => {
    const Carousel = server.widgets['@kroy/review-carousel'];
    const duplicate = [reviews[0], reviews[0]];
    const errors = [];
    const original = console.error;
    console.error = (...args) => { errors.push(args.join(' ')); };
    let html;
    try {
        html = renderToString(createElement(Carousel, { data: { title: 'Отзывы', reviews: duplicate } }));
    } finally {
        console.error = original;
    }
    assert.equal((html.match(/Первый отзыв/g) ?? []).length, 2);
    assert.equal(errors.filter((line) => /same key|unique "key"/i.test(line)).length, 0);
});

test('Page renders carousels through the shared Section root inside SiteRoot', () => {
    const content = [
        { part: '@kroy/material-list', props: { sectionId: 'news' }, view: { name: '@kroy/material-carousel', props: {} } },
        { part: '@kroy/reviews', props: { title: 'Отзывы', mode: 'auto' }, view: { name: '@kroy/review-carousel', props: { spacingTop: 'small', spacingBottom: 'none' } } },
    ];
    const html = renderToString(createElement(server.SiteRoot, null,
        createElement(server.Page, {
            content,
            parts: server.parts,
            widgets: server.widgets,
            materials: { news: { detailTemplate: { path: '/news/:slug', routeParam: 'slug' }, items: materialItems } },
            reviews,
        })));
    assert.equal((html.match(/data-card-carousel-item=""/g) ?? []).length, 4);
    assert.equal((html.match(/role="group"/g) ?? []).length, 2);
    assert.match(html, /data-card-carousel-item=""/);
    assert.match(html, /Отзывы/);
    assert.match(html, /padding-top:calc\(var\(--site-section-gap\) \/ 4\)/);
    assert.match(html, /padding-bottom:0/);
});
