import assert from 'node:assert/strict';
import test, { before, after } from 'node:test';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { build } from 'esbuild';
import { randomUUID } from 'node:crypto';
import { writeFile, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { discoverParts, discoverWidgets } from '../../build/registry/discoverParts.mjs';
import createSiteSvgPlugin from '../../build/site/siteSvgPlugin.mjs';
import { createMaterialListData } from './materialListData.mjs';
import { createClientPageRegistry, serializePagePayload } from '../../build/site/sitePageData.mjs';

const outputs = [];
let server;
let client;
let definitions;

before(async () => {
    const [parts, widgets] = await Promise.all([discoverParts(), discoverWidgets()]);
    definitions = parts;
    const imports = [];
    const registries = [];
    for (const [label, components] of [['parts', parts], ['widgets', widgets]]) {
        const entries = components.map((component, index) => {
            const variable = `${label}${index}`;
            imports.push(`import ${variable} from ${JSON.stringify(component.componentPath)};`);
            return `${JSON.stringify(component.name)}: ${variable}`;
        });
        registries.push(`export const ${label} = {${entries.join(',')}};`);
    }
    const contents = [...imports, ...registries, "export { default as SiteApp } from './site/runtime/SiteApp.jsx';"].join('\n');
    for (const platform of ['node', 'browser']) {
        const outfile = fileURLToPath(new URL(`.widgets-${platform}-${randomUUID()}.mjs`, import.meta.url));
        outputs.push(outfile);
        const result = await build({
            stdin: { contents, resolveDir: fileURLToPath(new URL('../../', import.meta.url)) },
            outfile, bundle: true, write: false, packages: 'external', platform, format: 'esm', jsx: 'automatic',
            loader: { '.module.css': 'local-css', '.png': 'dataurl' },
            plugins: [createSiteSvgPlugin({ root: fileURLToPath(new URL('../../', import.meta.url)) })],
        });
        await writeFile(outfile, result.outputFiles.find(({ path }) => path.endsWith('.mjs')).contents);
        const module = await import(pathToFileURL(outfile).href);
        if (platform === 'node') server = module;
        else client = module;
        assert.ok(result.outputFiles.some(({ path, text }) => path.endsWith('.css') && text.includes('review-progress')));
    }
});
after(() => Promise.all(outputs.map((path) => rm(path, { force: true }))));

const settings = {
    '@kroy/about': { title: 'About heading', text: 'First paragraph\n\nSecond paragraph' },
    '@kroy/material': {},
    '@kroy/material-list': { sectionId: 'section' },
    '@kroy/hero': { title: 'Hero heading', photo: '/hero.webp', description: 'Hero caption' },
    '@kroy/links': { title: 'Links heading' },
    '@kroy/contacts': { title: 'Contacts heading', zoom: 14 },
    '@kroy/services': { title: 'Services heading', categories: [{ title: 'Category', items: [{ name: 'Service name', price: '1000' }] }] },
    '@kroy/product-selection': { title: 'Selection heading', productIds: ['product'] },
    '@kroy/category-products': { title: 'Catalog heading', categoryId: '__all__' },
    '@kroy/reviews': { title: 'Reviews heading', mode: 'auto', showSubmitButton: true },
};
const expected = {
    '@kroy/about': /<p>First paragraph<\/p><p>Second paragraph<\/p>/,
    '@kroy/material': /Material body/,
    '@kroy/material-list': /List material/,
    '@kroy/hero': /Hero caption/,
    '@kroy/links': /href="\/social"/,
    '@kroy/contacts': /tel:\+79999999999/,
    '@kroy/services': /Service name/,
    '@kroy/product-selection': /Product name/,
    '@kroy/category-products': /Product name/,
    '@kroy/reviews': /Review body/,
};
const record = { slug: 'material', title: 'Material title', coverUrl: '/material.webp', content: { root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text: 'Material body' }] }] } } };
const siteData = {
    contacts: { phone: '+79999999999', latitude: 55, longitude: 37, socials: [{ name: 'Social', link: '/social' }] },
    catalog: { products: [{ id: 'product', name: 'Product name', price: '100.00', status: 'published' }] },
    reviews: [{ id: 'review', text: 'Review body', authorName: 'Author', reviewDate: '2026-10-31' }],
};

function render(module, page) {
    return renderToString(createElement(module.SiteApp, {
        pages: {}, path: '/', initialPage: page, parts: module.parts, widgets: module.widgets, ...siteData,
    }));
}

test('all default widgets preserve visible content and CSS Modules with identical server/client initial markup', () => {
    for (const definition of definitions) {
        const page = {
            path: '/', title: 'Page', record, context: { params: { entry: 'material' } },
            materials: definition.name === '@kroy/material-list' ? { section: createMaterialListData([{ slug: 'list-material', title: 'List material', status: 'published' }], null) } : undefined,
            content: [{ part: definition.name, props: settings[definition.name], view: { name: definition.defaultWidget, props: {} } }],
        };
        const html = render(server, page);
        assert.match(html, expected[definition.name]);
        assert.doesNotMatch(html, /undefined/);
        assert.equal(render(client, JSON.parse(serializePagePayload(page))), html);
        if (definition.name === '@kroy/reviews') {
            assert.match(html, /Оставить отзыв/);
            assert.match(html, /<dialog/);
            assert.match(html, /name="authorName"/);
            assert.match(html, /name="text"/);
        }
    }
});

test('both reviews widgets render exactly the supplied selection with the submit button and shared form', () => {
    for (const widget of ['@kroy/reviews-slider', '@kroy/review-cards']) {
        const data = { title: 'Отзывы', reviews: siteData.reviews, mode: 'manual', reviewIds: ['missing'], limit: 0, showSubmitButton: true };
        const html = renderToString(createElement(server.widgets[widget], { data, options: { columns: 4 } }));
        assert.match(html, /Review body/);
        assert.match(html, /Оставить отзыв/);
        assert.match(html, /<dialog/);
        if (widget === '@kroy/review-cards') assert.match(html, /data-columns="4"/);
    }
});

test('reduced-motion browser preferences do not change the slider initial hydration markup', () => {
    const data = { title: 'Отзывы', reviews: [...siteData.reviews, { ...siteData.reviews[0], id: 'second' }], showSubmitButton: true };
    const html = renderToString(createElement(server.widgets['@kroy/reviews-slider'], { data }));
    const previous = globalThis.window;
    try {
        globalThis.window = { matchMedia: () => ({ matches: true }) };
        assert.equal(renderToString(createElement(client.widgets['@kroy/reviews-slider'], { data })), html);
    } finally {
        if (previous === undefined) delete globalThis.window;
        else globalThis.window = previous;
    }
});

test('reviews slider renders nothing when there are no reviews and submission is disabled', () => {
    const html = renderToString(createElement(server.widgets['@kroy/reviews-slider'], {
        data: { title: 'Отзывы', reviews: [], showSubmitButton: false },
    }));
    assert.equal(html, '');
});

test('reviews slider without reviews keeps its heading, submit button and existing form', () => {
    const data = { title: 'Отзывы', reviews: [], showSubmitButton: true };
    const html = renderToString(createElement(server.widgets['@kroy/reviews-slider'], { data }));
    assert.match(html, /<h2[^>]*>Отзывы<\/h2>/);
    assert.match(html, /<button[^>]*>Оставить отзыв<\/button>/);
    assert.match(html, /<dialog/);
    assert.match(html, /name="authorName"/);
    assert.match(html, /name="text"/);
    assert.doesNotMatch(html, /<article|Предыдущий отзыв|Следующий отзыв|Пауза/);
    assert.equal(renderToString(createElement(client.widgets['@kroy/reviews-slider'], { data })), html);
});

test('reviews slider with reviews preserves slides, navigation and optional submission', () => {
    const reviews = [...siteData.reviews, { ...siteData.reviews[0], id: 'second', text: 'Second review' }];
    for (const showSubmitButton of [false, true]) {
        const html = renderToString(createElement(server.widgets['@kroy/reviews-slider'], {
            data: { title: 'Отзывы', reviews, showSubmitButton },
        }));
        assert.match(html, /Review body/);
        assert.match(html, /Second review/);
        assert.match(html, /Предыдущий отзыв/);
        assert.match(html, /Следующий отзыв/);
        assert.match(html, /Остановить автопрокрутку/);
        assert.equal(html.includes('Оставить отзыв</button>'), showSubmitButton);
    }
});

const listContent = [{ part: '@kroy/material-list', props: { sectionId: 'section' }, view: { name: '@kroy/material-cards', props: {} } }];
const listMaterial = { slug: 'example', title: 'List material', summary: 'Short description', coverUrl: '/cover.webp', status: 'published' };

test('SSR material cards show covers, summaries, section detail links, and matching hydration markup', () => {
    const page = {
        path: '/', title: 'Materials', content: listContent,
        materials: { section: createMaterialListData([listMaterial], { path: '/news/:slug', routeParam: 'slug' }) },
    };
    const html = render(server, page);
    assert.match(html, /src="\/cover\.webp"/);
    assert.match(html, /<h2[^>]*>List material<\/h2>/);
    assert.match(html, /Short description/);
    assert.match(html, /<a[^>]*href="\/news\/example"/);
    assert.equal(render(client, JSON.parse(serializePagePayload(page))), html);
});

test('material cards show an empty state or unlinked summaries when there is no detail template', () => {
    const base = { path: '/', title: 'Materials', content: listContent };
    assert.match(render(server, { ...base, materials: { section: createMaterialListData([], null) } }), /Опубликованных материалов пока нет/);
    const html = render(server, { ...base, materials: { section: createMaterialListData([{ ...listMaterial, coverUrl: null }], null) } });
    assert.match(html, /List material/);
    assert.doesNotMatch(html, /<a\b|Читать|<img\b/);
});

test('per-page material data survives client navigation and serialization', () => {
    const registry = createClientPageRegistry([
        { path: '/', title: 'Home', content: [] },
        { path: '/news', title: 'News', content: listContent, materials: { section: createMaterialListData([listMaterial], { path: '/news/:slug', routeParam: 'slug' }) } },
        { path: '/journal', title: 'Journal', content: listContent, materials: { section: createMaterialListData([listMaterial], { path: '/journal/:slug', routeParam: 'slug' }) } },
    ]);
    for (const path of ['/news', '/journal', '/', '/news']) {
        const props = { pages: registry, path, parts: server.parts, widgets: server.widgets };
        const html = renderToString(createElement(server.SiteApp, props));
        const hydrated = renderToString(createElement(client.SiteApp, {
            ...props, pages: JSON.parse(serializePagePayload(registry)), parts: client.parts, widgets: client.widgets,
        }));
        assert.equal(hydrated, html);
        if (path !== '/') assert.ok(html.includes(`href="${path}/example"`));
        else assert.doesNotMatch(html, /List material/);
    }
});
