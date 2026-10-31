import assert from 'node:assert/strict';
import test, { before, after } from 'node:test';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { build } from 'esbuild';
import { transform } from '@svgr/core';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { getPaymentProvider, describePaymentProvider } from '../../payments/providers.mjs';

let components;
const compiledPath = fileURLToPath(new URL(`.payments-test-${randomUUID()}.mjs`, import.meta.url));
before(async () => {
    const result = await build({
        stdin: {
            contents: `export { default as PaymentIntegrationEditor } from './components/admin/PaymentIntegrationEditor.jsx';
                export { default as CatalogEditor } from './components/admin/CatalogEditor.jsx';
                export { default as ProductCards } from './components/site/ProductCards.jsx';
                export { default as SiteSettingsLayout, SITE_SETTINGS_SECTIONS } from './components/admin/SiteSettingsLayout.jsx';
                export { default as SitePaymentsPage } from './pages/SitePaymentsPage.jsx';`,
            resolveDir: fileURLToPath(new URL('../../', import.meta.url)),
        },
        outfile: compiledPath, bundle: true, write: false, packages: 'external', platform: 'node', format: 'esm', jsx: 'automatic',
        loader: { '.module.css': 'local-css' },
        plugins: [{ name: 'svg', setup(builder) {
            builder.onLoad({ filter: /\.svg$/ }, async ({ path }) => ({
                contents: await transform(await readFile(path, 'utf8'), { plugins: ['@svgr/plugin-jsx'] }), loader: 'jsx',
            }));
        } }],
    });
    await writeFile(compiledPath, result.outputFiles.find(({ path }) => path.endsWith('.mjs')).contents);
    components = await import(pathToFileURL(compiledPath).href);
});
after(() => rm(compiledPath, { force: true }));

function descendants(element) {
    if (Array.isArray(element)) return element.flatMap(descendants);
    if (!element || typeof element !== 'object') return [];
    return [element, ...descendants(element.props?.children)];
}

test('payment fields render the provider schema and send edited settings without mutating saved data', () => {
    const provider = describePaymentProvider(getPaymentProvider('prodamus'));
    const settings = { payformDomain: '' };
    let changed;
    const element = components.PaymentIntegrationEditor({ provider, settings, disabled: false, onChange: (value) => { changed = value; } });
    const input = descendants(element).find(({ type }) => type === 'input');
    assert.equal(input.props.required, true);
    input.props.onChange({ target: { value: 'example.payform.ru' } });
    assert.deepEqual(changed, { payformDomain: 'example.payform.ru' });
    assert.equal(settings.payformDomain, '');
    const html = renderToString(createElement(components.PaymentIntegrationEditor, { provider, settings: changed, disabled: true, onChange() {} }));
    assert.match(html, /Адрес платёжной формы/);
    assert.match(html, /example.payform.ru/);
    assert.match(html, /disabled/);
    assert.match(html, /RUB/);
});

test('site settings expose a Payments section with its own page and the payments page renders a loading state on SSR', () => {
    assert.equal(components.SITE_SETTINGS_SECTIONS.find(({ id }) => id === 'payments').path, '/admin/site/payments');
    const html = renderToString(createElement(components.SitePaymentsPage));
    assert.match(html, /Загрузка/);
    const layout = renderToString(createElement(components.SiteSettingsLayout, { section: 'payments', title: 'Платежи', status: 'success' }));
    assert.match(layout, /aria-current="page"[^>]*>[^<]*<svg[\s\S]*Платежи/);
});

test('catalog admin and public product cards still render names, descriptions and ruble prices without purchase links', () => {
    const product = { id: 'product', name: 'Service', description: 'Description', price: '120.00', type: 'service', status: 'published' };
    const html = renderToString(createElement(components.ProductCards, { products: [product] }));
    assert.match(html, /Service/);
    assert.match(html, /Description/);
    assert.match(html, /120.00/);
    assert.match(html, /₽/);
    assert.doesNotMatch(html, /<a\b|Купить/);
    assert.match(renderToString(createElement(components.CatalogEditor, { value: { categories: [], products: [product] } })), /Service/);
});
