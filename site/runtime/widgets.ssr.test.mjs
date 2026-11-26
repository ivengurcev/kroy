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
import { getThemeTokens, getPageTheme } from '../themes/themeRegistry.mjs';

const outputs = [];
let server;
let client;
let definitions;
let widgetDefinitions;

before(async () => {
    const [parts, widgets] = await Promise.all([discoverParts(), discoverWidgets()]);
    definitions = parts;
    widgetDefinitions = widgets;
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
            loader: { '.module.css': 'local-css', '.png': 'dataurl', '.ttf': 'dataurl' },
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
    '@kroy/cta': { title: 'Action heading', subtitle: 'Action subtitle', price: '499 ₽', href: '/action' },
    '@kroy/comparison': { title: 'Comparison heading', rows: [{ title: 'Category', description: 'Category description', note: 'Category note', tone: 'success', examples: 'First example\nSecond example' }] },
    '@kroy/callout': { title: 'Callout heading', text: 'First callout paragraph\n\nSecond callout paragraph' },
    '@kroy/cards': { title: 'Cards heading', cards: [{ icon: { src: '/leaf.svg', mimeType: 'image/svg+xml' }, title: 'Card title', description: 'Card description' }] },
    '@kroy/separator': {},
    '@kroy/text': { title: 'About heading', text: 'First paragraph\n\nSecond paragraph' },
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
    '@kroy/cta': /href="\/action"/,
    '@kroy/comparison': /Second example/,
    '@kroy/callout': /Second callout paragraph/,
    '@kroy/cards': /Card description/,
    '@kroy/separator': /role="separator"/,
    '@kroy/text': /<p>First paragraph<\/p><p>Second paragraph<\/p>/,
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
        if (definition.name === '@kroy/comparison') {
            assert.equal(Object.keys(definition.fields.rows.fields)[0], 'tone');
            assert.match(html, /<p>First example\nSecond example<\/p>/);
            assert.equal((html.match(/<ul\b/g) ?? []).length, 1); // No implicit list for example lines.
        }
        assert.doesNotMatch(html, /undefined/);
        assert.equal(render(client, JSON.parse(serializePagePayload(page))), html);
        if (definition.name === '@kroy/cta') {
            const cases = [
                { title: 'Записаться', href: '/booking' },
                { title: 'Купить', subtitle: 'Материал', price: '499 ₽', href: 'https://example.com', icon: { src: '/cta.svg', mimeType: 'image/svg+xml' } },
                { title: 'Скачать', href: '#guide', icon: { src: '/cta.webp', mimeType: 'image/webp' } },
                { title: 'ДлиннаяНадпись'.repeat(40), subtitle: 'Дополнительная строка '.repeat(30), price: 'Любая текстовая метка '.repeat(20), href: '../action' },
                { title: 'Нет адреса' },
                { title: 'Некорректный адрес', href: 'javascript:alert(1)' },
                { title: 'Некорректный HTTP', href: 'https://' },
                { icon: '/only-icon.svg' },
                {},
            ];
            for (const mode of ['light', 'dark']) for (const base of [16, 18, 20]) for (const props of cases) {
                const initialPage = { ...page, content: [{ part: definition.name, props, view: { name: definition.defaultWidget, props: {} } }] };
                const tokens = { ...getThemeTokens('calm', mode), '--site-font-size-base': `${base}px`, colorScheme: mode };
                const input = { path: '/', initialPage, tokens };
                const renderCta = (module) => renderToString(createElement(module.SiteApp, { ...input, parts: module.parts, widgets: module.widgets }));
                const initial = renderCta(server);
                assert.equal(renderCta(client), initial);
                if (!props.title) assert.doesNotMatch(initial, /<section\b|only-icon/);
                else {
                    assert.ok(initial.includes(props.title));
                    const href = server.parts[definition.name]({ props }).href;
                    if (href) {
                        assert.match(initial, /<a\b/);
                        assert.match(initial, /data-native-navigation=""/);
                        assert.ok(initial.includes(`href="${href}"`));
                        assert.equal((initial.match(/<a\b/g) ?? []).length, 1);
                    } else assert.doesNotMatch(initial, /<a\b|href=/);
                    if (!props.icon) assert.doesNotMatch(initial, /<img\b|mask-image/);
                    if (props.icon?.mimeType === 'image/svg+xml') assert.match(initial, /mask-image:url\(&quot;\/cta.svg&quot;\)/);
                    if (props.icon?.mimeType === 'image/webp') assert.match(initial, /<img[^>]*src="\/cta.webp"[^>]*alt=""/);
                }
            }
        }
        if (definition.name === '@kroy/callout') {
            const cases = [
                { title: 'Длинный заголовок '.repeat(20), text: 'Первый абзац\n\nВторой абзац' },
                { title: 'Примечание', text: 'Текст', icon: { src: '/api/media/callout-vector', mimeType: 'image/svg+xml' } },
                { text: 'Текст без заголовка', icon: { src: '/api/media/callout-raster', mimeType: 'image/webp' } },
                { title: 'Только заголовок' },
                { text: 'Длинный текст '.repeat(100) },
                { icon: '/only-icon.svg' },
                {},
            ];
            for (const mode of ['light', 'dark']) for (const base of [16, 18, 20]) for (const props of cases) {
                const initialPage = { ...page, content: [{ part: definition.name, props, view: { name: definition.defaultWidget, props: {} } }] };
                const tokens = { ...getThemeTokens('calm', mode), '--site-font-size-base': `${base}px` };
                const input = { path: '/', initialPage, tokens };
                const renderCallout = (module) => renderToString(createElement(module.SiteApp, { ...input, parts: module.parts, widgets: module.widgets }));
                const initial = renderCallout(server);
                assert.equal(renderCallout(client), initial);
                assert.doesNotMatch(initial, /role="alert"|aria-live|<h1\b|<p[^>]*><\/p>/);
                if (!props.title && !props.text) assert.doesNotMatch(initial, /<section\b|only-icon/);
                if (props.title) assert.ok(initial.includes(props.title.trim()));
                else assert.doesNotMatch(initial, /<h2\b/);
                if (!props.icon) assert.doesNotMatch(initial, /<img\b|mask-image/);
                if (props.icon?.mimeType === 'image/svg+xml') assert.match(initial, /mask-image:url\(&quot;\/api\/media\/callout-vector&quot;\)/);
                if (props.icon?.mimeType === 'image/webp') assert.match(initial, /<img[^>]*src="\/api\/media\/callout-raster"[^>]*alt=""/);
            }
            assert.match(html, /<p>First callout paragraph<\/p><p>Second callout paragraph<\/p>/);
        }
        if (definition.name === '@kroy/reviews') {
            assert.match(html, /Оставить отзыв/);
            assert.match(html, /<dialog/);
            assert.match(html, /name="authorName"/);
            assert.match(html, /name="text"/);
        }
        if (definition.name === '@kroy/hero') {
            for (const widget of ['@kroy/hero', '@kroy/hero-editorial']) {
                const field = widgetDefinitions.find(({ name }) => name === widget).fields.showContacts;
                assert.equal(field.type, 'switch');
                assert.equal(field.default, true);
                for (const showContacts of [undefined, true, false]) {
                    const heroPage = { ...page, content: [{ ...page.content[0], view: { name: widget, props: showContacts === undefined ? {} : { showContacts } } }] };
                    const heroHtml = render(server, heroPage);
                    if (showContacts === false) assert.doesNotMatch(heroHtml, /aria-label="Социальные сети"|href="\/social"/);
                    else assert.match(heroHtml, /href="\/social"/);
                    assert.equal(render(client, heroPage), heroHtml);
                }
            }
            const editorialPage = { ...page, content: [{
                part: definition.name,
                props: { title: 'Hero', features: [
                    { icon: { src: '/api/media/hero-vector', mimeType: 'image/svg+xml' }, text: 'SVG feature' },
                    { icon: { src: '/hero-icon.webp', mimeType: 'image/webp' }, text: 'Raster feature' },
                    { icon: 'leaf', text: 'Legacy feature' },
                ] },
                view: { name: '@kroy/hero-editorial', props: {} },
            }] };
            const editorial = render(server, editorialPage);
            assert.match(editorial, /mask-image:url\(&quot;\/api\/media\/hero-vector&quot;\)/);
            assert.match(editorial, /<img[^>]*src="\/hero-icon.webp"/);
            assert.doesNotMatch(editorial, /src="leaf"/);
            assert.equal(render(client, editorialPage), editorial);
        }
        if (definition.name === '@kroy/cards') {
            for (const count of [1, 4, 8]) {
                for (const columns of [1, 2, 3, 4]) {
                    for (const base of [16, 18, 20]) {
                        const content = [{
                            part: definition.name,
                            props: { headingIcon: '/info.svg', cards: Array.from({ length: count }, (_, index) => ({
                                icon: [{ src: '/api/media/vector', mimeType: 'image/svg+xml' }, '/cart.webp', '/ruble.svg', ''][index % 4],
                                title: `Card ${index} ${'Длинное название '.repeat(8)}`,
                                description: index % 2 ? '' : 'Описание\nс переносом',
                            })) },
                            view: { name: definition.defaultWidget, props: { columns } },
                        }];
                        const initialPage = { ...page, content };
                        const input = { path: '/', initialPage, tokens: { '--site-font-size-base': `${base}px` } };
                        const renderCards = (module) => renderToString(createElement(module.SiteApp, {
                            ...input, parts: module.parts, widgets: module.widgets,
                        }));
                        const initial = renderCards(server);
                        assert.equal((initial.match(/<li\b/g) ?? []).length, count);
                        assert.match(initial, new RegExp(`data-columns="${columns}"`));
                        assert.match(initial, new RegExp(`--site-font-size-base:${base}px`));
                        assert.doesNotMatch(initial, /<header\b|<h2\b|<p[^>]*><\/p>/);
                        assert.equal(renderCards(client), initial);
                        assert.match(initial, /mask-image:url\(&quot;\/api\/media\/vector&quot;\)/);
                        if (count > 1) assert.match(initial, /<img[^>]*src="\/cart.webp"/);
                    }
                }
            }
            const emptyPage = { ...page, content: [{ part: definition.name, props: {}, view: { name: definition.defaultWidget, props: {} } }] };
            assert.doesNotMatch(render(server, emptyPage), /<ul\b|<header\b|<section\b/);
        }
    }
});

test('page palettes are present in SSR and identical in the first client render', () => {
    const settings = { themeId: 'calm', themeMode: 'light', overrides: {} };
    const theme = { ...getPageTheme(settings), separatorUrl: '/global.svg', separatorMimeType: 'image/svg+xml' };
    for (const appearance of [{}, { themeMode: 'dark' }, { themeId: 'amber' }, { themeMode: 'system', overrides: { light: { '--site-color-bg': '#abcdef' }, shared: { '--site-font-size-base': '20px' } } }]) {
        const page = { path: '/', title: 'Page', content: [], theme: getPageTheme(settings, appearance) };
        const registry = createClientPageRegistry([page]);
        const input = { pages: registry, path: '/', theme };
        const renderPage = (module) => renderToString(createElement(module.SiteApp, { ...input, parts: module.parts, widgets: module.widgets }));
        const initial = renderPage(server);
        assert.equal(renderPage(client), initial);
        const palette = appearance.themeMode === 'dark' ? 'dark' : 'light';
        assert.ok(initial.includes(`--site-color-bg:${page.theme[palette]['--site-color-bg']}`));
        assert.ok(initial.includes(`color-scheme:${palette}`));
    }
});

test('richtext fields keep formatting across all approved widgets, SSR/client and saved page payloads', () => {
    const rich = { root: { type: 'root', children: [
        { type: 'heading', tag: 'h2', children: [{ type: 'text', text: 'Rich heading' }] },
        { type: 'heading', tag: 'h3', children: [{ type: 'text', text: 'Small heading' }] },
        { type: 'paragraph', children: [{ type: 'text', text: 'Marked text', format: 1 | 2 | 8 }] },
        { type: 'list', listType: 'bullet', children: [{ type: 'listitem', children: [{ type: 'text', text: 'Bullet item' }] }] },
        { type: 'list', listType: 'number', children: [{ type: 'listitem', children: [{ type: 'text', text: 'Number item' }] }] },
        { type: 'paragraph', children: [{ type: 'link', url: '/safe', children: [{ type: 'text', text: 'Link' }] }] },
        { type: 'horizontalrule', version: 1 },
    ] } };
    for (const [part, widget, props] of [
        ['@kroy/text', '@kroy/text', { title: 'Text', text: rich }],
        ['@kroy/text', '@kroy/text-editorial', { title: 'Text', text: rich, lead: 'Lead', photo: '/photo.webp' }],
        ['@kroy/callout', '@kroy/callout', { title: 'Callout', text: rich }],
        ['@kroy/hero', '@kroy/hero', { title: 'Hero', description: rich }],
        ['@kroy/hero', '@kroy/hero-editorial', { title: 'Hero', lead: rich, description: rich, features: [{ text: rich }] }],
        ['@kroy/comparison', '@kroy/comparison-rows', { rows: [{ title: 'Category', description: rich, note: rich, examples: rich }] }],
        ['@kroy/comparison', '@kroy/comparison-rows', { rows: [{ examples: rich }] }],
    ]) for (const base of [16, 18, 20]) {
        const page = { path: '/', title: 'Page', content: [{ part, props, view: { name: widget, props: {} } }] };
        const input = { path: '/', tokens: { '--site-font-size-base': `${base}px` } };
        const renderPage = (module, initialPage) => renderToString(createElement(module.SiteApp, { ...input, initialPage, pages: {}, parts: module.parts, widgets: module.widgets }));
        const html = renderPage(server, page);
        assert.equal(renderPage(client, JSON.parse(serializePagePayload(page))), html);
        assert.equal(renderPage(server, createClientPageRegistry([page])['/']), html);
        assert.match(html, /<h2>Rich heading<\/h2>/);
        assert.match(html, /<h3>Small heading<\/h3>/);
        assert.match(html, /<p><u><em><strong>Marked text<\/strong><\/em><\/u><\/p>/);
        assert.match(html, /<ul><li>Bullet item<\/li><\/ul>/);
        assert.match(html, /<ol><li>Number item<\/li><\/ol>/);
        assert.match(html, /href="\/safe"/);
        assert.match(html, /<hr\/>/);
        assert.doesNotMatch(html, /<p[^>]*><(?:div|p|h2|h3|ul|ol)\b/);
    }
    for (const part of ['@kroy/text', '@kroy/callout', '@kroy/comparison']) {
        const definition = definitions.find(({ name }) => name === part);
        const empty = { root: { type: 'root', children: [{ type: 'paragraph', children: [] }] } };
        const props = part === '@kroy/comparison' ? { rows: [{ description: empty, note: empty, examples: empty }] } : { text: empty };
        const page = { path: '/', title: 'Empty', content: [{ part, props, view: { name: definition.defaultWidget, props: {} } }] };
        assert.doesNotMatch(render(server, page), /<section\b|<p\b|<h2\b|<h3\b/);
    }
    const paragraph = { root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text: 'Only paragraph' }] }] } };
    const page = { path: '/', title: 'Page', content: [{ part: '@kroy/comparison', props: { rows: [{ examples: paragraph }] }, view: { name: '@kroy/comparison-rows', props: {} } }] };
    const html = render(server, page);
    assert.match(html, /<p>Only paragraph<\/p>/);
    assert.equal((html.match(/<ul\b/g) ?? []).length, 1); // Only the outer category list.
    const divider = { root: { type: 'root', children: [{ type: 'horizontalrule', version: 1 }] } };
    const dividerPage = { ...page, content: [{ ...page.content[0], props: { rows: [{ description: divider, highlight: 'Removed highlight' }] } }] };
    const dividerHtml = render(server, dividerPage);
    assert.match(dividerHtml, /<hr\/>/);
    assert.doesNotMatch(dividerHtml, /Removed highlight/);
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

test('spacing applies to existing roots of all widgets, stays local, and matches serialized client markup', () => {
    for (const widget of widgetDefinitions) {
        const definition = definitions.find(({ contract }) => contract === widget.contract);
        const item = { part: definition.name, props: settings[definition.name], view: { name: widget.name, props: {} } };
        const page = { path: '/', record, content: [item], materials: { section: createMaterialListData([], null) } };
        const original = render(server, page);
        const auto = { ...page, content: [{ ...item, view: { ...item.view, props: { spacingTop: 'auto', spacingBottom: 'auto' } } }] };
        assert.equal(render(server, auto), original);
        for (const [spacingTop, spacingBottom] of [['none', 'large'], ['small', 'normal']]) {
            const changed = { ...item, view: { ...item.view, props: { spacingTop, spacingBottom } } };
            const spaced = { ...page, content: [changed, item] };
            const html = render(server, spaced);
            assert.equal((html.match(/padding-top:/g) ?? []).length, 1, widget.name);
            assert.equal((html.match(/padding-bottom:/g) ?? []).length, 1, widget.name);
            assert.equal(render(client, JSON.parse(serializePagePayload(spaced))), html);
            const rootTags = (text) => text.match(/<(?:section|article)\b/g)?.length ?? 0;
            assert.equal(rootTags(html), rootTags(original) * 2, 'no extra section wrapper');
        }
    }
});

test('both Hero schemas expose height modes, preserve legacy normal height and ignore it in other modes', () => {
    for (const name of ['@kroy/hero', '@kroy/hero-editorial']) {
        const fields = widgetDefinitions.find((widget) => widget.name === name).fields;
        assert.equal(fields.minHeight, undefined);
        assert.deepEqual(fields.heightMode.options, ['compact', 'normal', 'spacious']);
        assert.equal(fields.heightMode.default, 'normal');
        for (const heightMode of [undefined, 'normal', 'compact', 'spacious']) {
            const page = { path: '/', content: [{
                part: '@kroy/hero', props: { title: 'Long title '.repeat(100), photo: '/hero.webp', description: 'Long description '.repeat(100) },
                view: { name, props: { heightMode, minHeight: 900 } },
            }] };
            const html = render(server, page);
            assert.match(html, new RegExp(`data-height-mode="${heightMode ?? 'normal'}"`));
            assert.equal(html.includes('--hero-min-height:900px'), !heightMode || heightMode === 'normal');
            assert.equal(render(client, JSON.parse(serializePagePayload(page))), html);
            assert.ok(html.includes('Long title '.repeat(100).trim()));
        }
    }
});

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
