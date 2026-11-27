import assert from 'node:assert/strict';
import test, { before, after } from 'node:test';
import { act, createElement } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { build } from 'esbuild';
import { randomUUID } from 'node:crypto';
import { writeFile, rm, readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { prepareSiteFooter } from '../../shared/footerSettings.mjs';
import { legalDocumentBlock } from '../../shared/legalDocuments.mjs';
import { toLexicalDocument } from '../../admin/ui/richTextState.mjs';
import { getPageTheme } from '../themes/themeRegistry.mjs';

const outputs = [];
let server;
let client;
before(async () => {
    for (const platform of ['node', 'browser']) {
        const outfile = new URL(`.Footer-${platform}-${randomUUID()}.mjs`, import.meta.url);
        outputs.push(outfile);
        const result = await build({
            stdin: { contents: `
                export { default as SiteApp } from './site/runtime/SiteApp.jsx';
                export { default as Footer } from './site/widgets/footer/Footer.jsx';
                export { default as Header } from './site/widgets/header/Header.jsx';
                export { default as Document } from './site/widgets/document/Document.jsx';
                export { default as prepareFooter } from './site/parts/footer/prepareFooter.mjs';
                export { default as prepareHeader } from './site/parts/header/prepareHeader.mjs';
                export { default as prepareDocument } from './site/parts/document/prepareDocument.mjs';
            `, resolveDir: process.cwd() },
            outfile: outfile.pathname, bundle: true, write: false, packages: 'external',
            platform, format: 'esm', jsx: 'automatic', loader: { '.module.css': 'local-css', '.ttf': 'dataurl' },
        });
        await writeFile(outfile, result.outputFiles.find(({ path }) => path.endsWith('.mjs')).contents);
        const module = await import(outfile.href);
        if (platform === 'node') server = module;
        else client = module;
    }
});
after(() => Promise.all(outputs.map((path) => rm(path, { force: true }))));

test('empty footer renders site name and copyright without optional groups or branding', () => {
    const footer = prepareSiteFooter({ id: 'site', name: 'Клиника' }, {}, [], 2026);
    const html = renderToString(createElement(server.Footer, { data: server.prepareFooter({ props: footer }) }));
    assert.match(html, /Клиника/);
    assert.match(html, /© <!-- -->2026/);
    assert.doesNotMatch(html, /<nav|<address|<h2|ИНН|ОГРН|oysite\.ru/);
    assert.equal(renderToString(createElement(client.Footer, { data: client.prepareFooter({ props: footer }) })), html);
});

test('footer displays shared contacts, safe social links and optional legal data without unsafe destinations', () => {
    const footer = { siteName: 'Site', year: 2026, legal: { name: 'ООО Клиника', inn: '1234567890', registrationNumber: '1234567890123' } };
    const contacts = {
        phone: '+7 (999) 123-45-67', email: 'mail@example.org', address: 'Адрес\nГород',
        socials: [{ type: 'telegram', value: '@clinic' }, { type: 'other', link: 'javascript:alert(1)', name: 'Unsafe' }],
    };
    const html = renderToString(createElement(server.Footer, { data: server.prepareFooter({ props: footer, contacts }) }));
    assert.match(html, /href="tel:\+79991234567"/);
    assert.match(html, /href="mailto:mail@example.org"/);
    assert.match(html, /href="https:\/\/t.me\/clinic"/);
    assert.match(html, /ИНН <!-- -->1234567890/);
    assert.match(html, /ОГРН\/ОГРНИП <!-- -->1234567890123/);
    assert.match(html, /ООО Клиника/);
    assert.doesNotMatch(html, /javascript:|Unsafe/);
    assert.equal(renderToString(createElement(client.Footer, { data: client.prepareFooter({ props: footer, contacts }) })), html);
});

test('every page kind gets exactly one SSR footer with global theme; browser initial markup is identical', () => {
    const theme = getPageTheme({ themeId: 'calm', themeMode: 'light', overrides: { light: { '--site-color-bg': '#abcdef' } } });
    const pageTheme = getPageTheme({ themeId: 'calm', themeMode: 'dark', overrides: {} });
    const footer = { siteName: 'Site', year: 2026, navigation: [{ label: 'About', href: '/about' }] };
    const header = (title) => ({ part: '@kroy/header', props: { title }, view: { name: '@kroy/header', props: {} } });
    const templates = [{ before: [header('Before')], after: [header('After')] }];
    const pages = Object.fromEntries(['/', '/about', '/news'].map((path) => [path, {
        path, content: [header('Own')], theme: pageTheme, templateIndex: path === '/about' ? undefined : 0,
    }]));
    const registry = (entry) => ({
        parts: { '@kroy/footer': entry.prepareFooter, '@kroy/header': entry.prepareHeader },
        widgets: { '@kroy/footer': entry.Footer, '@kroy/header': entry.Header },
    });
    for (const path of ['/', '/about', '/news', '/news/entry']) {
        const props = { pages, path, theme, footer, templates,
            ...(path === '/news/entry' ? { initialPage: { path, content: [header('Own')], record: { title: 'Entry' }, theme: pageTheme, templateIndex: 0 } } : {}) };
        const html = renderToString(createElement(server.SiteApp, { ...props, ...registry(server) }));
        assert.equal(renderToString(createElement(client.SiteApp, { ...JSON.parse(JSON.stringify(props)), ...registry(client) })), html);
        const dom = new JSDOM(html);
        try {
            const element = dom.window.document.querySelector('footer');
            assert.equal(dom.window.document.querySelectorAll('footer').length, 1);
            assert.equal(element.parentElement.style.getPropertyValue('--site-color-bg'), '#abcdef');
            assert.equal(element.parentElement.style.colorScheme, 'light');
            assert.equal(element.querySelectorAll('a[href="https://oysite.ru/"]').length, 0);
            assert.equal(dom.window.document.querySelectorAll('a[href="https://oysite.ru/"]').length, 1);
            assert.equal(element.querySelector('a[href="/about"]').textContent, 'About');
            assert.deepEqual([...dom.window.document.querySelectorAll('header')].map(({ textContent }) => textContent),
                path === '/about' ? ['Own'] : ['Before', 'Own', 'After']);
        } finally { dom.window.close(); }
    }
});

test('static SSR and hydration consume the same release-owned footer snapshot, without API fetching', async () => {
    const [builder, renderer, hydrate] = await Promise.all(['../../build/site/buildSite.mjs', '../../build/site/renderSite.jsx', '../../build/site/hydrateSite.jsx']
        .map((path) => readFile(new URL(path, import.meta.url), 'utf8')));
    assert.match(builder, /footer_settings/);
    assert.match(builder, /prepareSiteFooter\(site, site.footer_settings, pages\)/);
    for (const source of [renderer, hydrate]) {
        assert.match(source, /import \{ footer \} from '\.\.\/\.\.\/dist\/kroy\/site-footer.mjs'/);
        assert.match(source, /footer=\{footer\}/);
        assert.doesNotMatch(source, /fetch\(/);
    }
});

test('legal document uses the same formatted, safe markup in SSR and client runtime', () => {
    const path = '/legal/terms';
    const text = toLexicalDocument('Условия\n\nУслуги\n\nОплата\n\nНедопустимая ссылка');
    const [heading, paragraph, list, unsafe] = text.root.children;
    Object.assign(heading, { type: 'heading', tag: 'h2' });
    const [service] = paragraph.children;
    paragraph.children = [{ type: 'link', version: 1, url: '/services', children: [{ ...service, format: 1 }] }];
    text.root.children[2] = { type: 'list', listType: 'number', tag: 'ol', start: 1, version: 1,
        children: [{ type: 'listitem', value: 1, version: 1, children: list.children }] };
    unsafe.children = [{ type: 'link', version: 1, url: 'javascript:alert(1)', children: unsafe.children }];
    const page = { id: 'terms', site_id: 'site', isLegalDocument: true, path, title: 'Договор', content: [legalDocumentBlock(text)], templateIndex: 0 };
    const header = { part: '@kroy/header', props: { title: 'Шапка' }, view: { name: '@kroy/header', props: {} } };
    const props = {
        pages: { [path]: page }, path, templates: [{ before: [header], after: [] }],
        footer: prepareSiteFooter({ id: 'site', name: 'Сайт' }, {}, [page], 2026),
    };
    const render = (entry, data) => renderToString(createElement(entry.SiteApp, {
        ...data,
        parts: { '@kroy/document': entry.prepareDocument, '@kroy/header': entry.prepareHeader, '@kroy/footer': entry.prepareFooter },
        widgets: { '@kroy/document': entry.Document, '@kroy/header': entry.Header, '@kroy/footer': entry.Footer },
    }));
    const html = render(server, props);
    assert.equal(render(client, JSON.parse(JSON.stringify(props))), html);
    assert.match(html, /<h2>Условия<\/h2>/);
    assert.match(html, /<a href="\/services"><strong>Услуги<\/strong><\/a>/);
    assert.match(html, /<ol><li>Оплата<\/li><\/ol>/);
    assert.match(html, /Недопустимая ссылка/);
    assert.doesNotMatch(html, /javascript:/);
    assert.match(html, /<footer[\s\S]*<a href="\/legal\/terms">Договор<\/a>/);
    assert.ok(html.indexOf('<header') < html.indexOf('<h2>Условия'));
    assert.ok(html.indexOf('<h2>Условия') < html.indexOf('<footer'));
});

test('hydrated site switches layouts without remounting its footer or branding', async () => {
    const block = { part: '@kroy/header', props: { title: 'Shared heading' }, view: { name: '@kroy/header', props: {} } };
    const input = {
        pages: { '/': { path: '/', content: [], templateIndex: 0 }, '/other': { path: '/other', content: [] } },
        templates: [{ before: [block], after: [] }],
        footer: { siteName: 'Site', year: 2026, navigation: [{ href: '/other', label: 'Next' }] }, path: '/',
    };
    const render = (entry) => createElement(entry.SiteApp, {
        ...input,
        parts: { '@kroy/header': entry.prepareHeader, '@kroy/footer': entry.prepareFooter },
        widgets: { '@kroy/header': entry.Header, '@kroy/footer': entry.Footer },
    });
    const dom = new JSDOM(`<div id="root">${renderToString(render(server))}</div>`, { url: 'https://example.test/' });
    const globals = { window: dom.window, document: dom.window.document, Element: dom.window.Element,
        history: dom.window.history, IS_REACT_ACT_ENVIRONMENT: true };
    const previous = Object.fromEntries(Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    let root;
    try {
        for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
        const errors = [];
        const footer = document.querySelector('footer');
        const brand = document.querySelector('a[href="https://oysite.ru/"]');
        await act(async () => { root = hydrateRoot(document.getElementById('root'), render(client), { onRecoverableError: (error) => errors.push(error) }); });
        await act(async () => {
            footer.querySelector('a').dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
        });
        assert.equal(window.location.pathname, '/other');
        assert.equal(document.querySelector('header'), null);
        assert.equal(document.querySelector('footer'), footer);
        assert.equal(document.querySelector('a[href="https://oysite.ru/"]'), brand);
        await act(async () => {
            history.replaceState(null, '', '/');
            window.dispatchEvent(new window.PopStateEvent('popstate'));
        });
        assert.equal(document.querySelector('header').textContent, 'Shared heading');
        assert.deepEqual(errors, []);
    } finally {
        if (root) await act(async () => root.unmount());
        for (const [key, descriptor] of Object.entries(previous)) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor);
            else delete globalThis[key];
        }
        dom.window.close();
    }
});
