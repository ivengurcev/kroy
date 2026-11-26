import assert from 'node:assert/strict';
import test, { before, after } from 'node:test';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { build } from 'esbuild';
import { randomUUID } from 'node:crypto';
import { writeFile, rm, readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { prepareSiteFooter } from '../../shared/footerSettings.mjs';
import { getPageTheme } from '../themes/themeRegistry.mjs';

const outputs = [];
let server;
let client;
before(async () => {
    for (const platform of ['node', 'browser']) {
        const outfile = new URL(`.Footer-${platform}-${randomUUID()}.mjs`, import.meta.url);
        outputs.push(outfile);
        const result = await build({
            stdin: { contents: "export { default as SiteApp } from './site/runtime/SiteApp.jsx'; export { default as SiteFooter } from './site/runtime/SiteFooter.jsx';", resolveDir: process.cwd() },
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

test('empty footer always renders site name, copyright and immutable ordinary Oysite link; optional groups stay absent', () => {
    const footer = prepareSiteFooter({ id: 'site', name: 'Клиника' }, {}, [], 2026);
    const html = renderToString(createElement(server.SiteFooter, { footer: { ...footer, showBranding: false, brandingUrl: 'https://evil.org' } }));
    assert.match(html, /Клиника/);
    assert.match(html, /© <!-- -->2026/);
    assert.match(html, /<a[^>]+href="https:\/\/oysite.ru\/">Создано на Oysite<\/a>/);
    assert.doesNotMatch(html, /<nav|<address|<h2|ИНН|ОГРН|evil\.org/);
    assert.equal(renderToString(createElement(client.SiteFooter, { footer })), html);
});

test('footer displays shared contacts, safe social links and optional legal data without unsafe destinations', () => {
    const footer = { siteName: 'Site', year: 2026, legal: { name: 'ООО Клиника', inn: '1234567890', registrationNumber: '1234567890123' } };
    const contacts = {
        phone: '+7 (999) 123-45-67', email: 'mail@example.org', address: 'Адрес\nГород',
        socials: [{ type: 'telegram', value: '@clinic' }, { type: 'other', link: 'javascript:alert(1)', name: 'Unsafe' }],
    };
    const html = renderToString(createElement(server.SiteFooter, { footer, contacts }));
    assert.match(html, /href="tel:\+79991234567"/);
    assert.match(html, /href="mailto:mail@example.org"/);
    assert.match(html, /href="https:\/\/t.me\/clinic"/);
    assert.match(html, /ИНН <!-- -->1234567890/);
    assert.match(html, /ОГРН\/ОГРНИП <!-- -->1234567890123/);
    assert.match(html, /ООО Клиника/);
    assert.doesNotMatch(html, /javascript:|Unsafe/);
    assert.equal(renderToString(createElement(client.SiteFooter, { footer, contacts })), html);
});

test('every page kind gets exactly one SSR footer with global theme; browser initial markup is identical', () => {
    const theme = getPageTheme({ themeId: 'calm', themeMode: 'light', overrides: { light: { '--site-color-bg': '#abcdef' } } });
    const pageTheme = getPageTheme({ themeId: 'calm', themeMode: 'dark', overrides: {} });
    const footer = { siteName: 'Site', year: 2026, navigation: [{ label: 'About', href: '/about' }] };
    const pages = Object.fromEntries(['/', '/about', '/news'].map((path) => [path, { path, content: [], theme: pageTheme }]));
    for (const path of ['/', '/about', '/news', '/news/entry']) {
        const props = { pages, path, parts: {}, widgets: {}, theme, footer,
            ...(path === '/news/entry' ? { initialPage: { path, content: [], record: { title: 'Entry' }, theme: pageTheme } } : {}) };
        const html = renderToString(createElement(server.SiteApp, props));
        assert.equal(renderToString(createElement(client.SiteApp, JSON.parse(JSON.stringify(props)))), html);
        const dom = new JSDOM(html);
        try {
            const element = dom.window.document.querySelector('footer');
            assert.equal(dom.window.document.querySelectorAll('footer').length, 1);
            assert.equal(element.parentElement.style.getPropertyValue('--site-color-bg'), '#abcdef');
            assert.equal(element.parentElement.style.colorScheme, 'light');
            assert.equal(element.querySelectorAll('a[href="https://oysite.ru/"]').length, 1);
            assert.equal(element.querySelector('a[href="/about"]').textContent, 'About');
            assert.equal(element.parentElement.previousElementSibling.style.colorScheme, 'dark');
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
