import assert from 'node:assert/strict';
import test, { before, after } from 'node:test';
import { createElement, Fragment, useState } from 'react';
import { renderToString } from 'react-dom/server';
import { build } from 'esbuild';
import { transform } from '@svgr/core';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { getPaymentProvider, describePaymentProvider } from '../../server/payments/providers.mjs';

let components;
const compiledPath = fileURLToPath(new URL(`.payments-test-${randomUUID()}.mjs`, import.meta.url));
before(async () => {
    const result = await build({
        stdin: {
            contents: `export { default as PaymentIntegrationEditor } from './admin/components/PaymentIntegrationEditor.jsx';
                 export { default as CatalogEditor, catalogProductsCanLoad } from './admin/components/CatalogEditor.jsx';
                export { default as ProductCards, ProductCard } from './site/components/ProductCards.jsx';
                export { default as SiteSettingsLayout, SITE_SETTINGS_SECTIONS } from './admin/components/SiteSettingsLayout.jsx';
                export { default as AdminSidebar } from './admin/components/AdminSidebar.jsx';
                export { default as SiteMaterialsPage } from './admin/pages/SiteMaterialsPage.jsx';
                 export { default as SiteOrdersPage } from './admin/pages/SiteOrdersPage.jsx';
                 export { default as SiteReviewsPage } from './admin/pages/SiteReviewsPage.jsx';
                 export { Pagination, useListPage } from './admin/components/AdminList.jsx';
                export { default as PaymentResult } from './site/payments/PaymentResult.jsx';
                export { default as SitePaymentsPage } from './admin/pages/SitePaymentsPage.jsx';
                export { default as ActionFooter } from './admin/components/ActionFooter.jsx';
                export { default as AdminPageShell } from './admin/components/AdminPageShell.jsx';
                export { default as AdminHeader } from './admin/components/AdminHeader.jsx';
                export { default as AdminShell } from './admin/components/AdminShell.jsx';
                export { MaterialActions } from './admin/pages/SiteMaterialEditorPage.jsx';
                 export { default as useAutoSlug } from './admin/editor/useAutoSlug.jsx';
                 export { default as PageList } from './admin/components/PageList.jsx';
                 export { default as PageSettingsPage } from './admin/pages/PageSettingsPage.jsx';
                 export { default as PageDetailsForm } from './admin/components/PageDetailsForm.jsx';`,
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

test('page tree opens content by title and settings via a dedicated URL, not inline form', () => {
    const pages = [{ id: 'page', title: 'About', path: '/about', redirects: ['/old'] }, { id: 'deleted', title: 'Deleted', path: '/deleted', deleted_at: 'now' }];
    const html = renderToString(createElement(components.PageList, { pages }));
    assert.match(html, /href="\/admin\/pages\/page"/);
    assert.match(html, /href="\/admin\/pages\/page\/settings"/);
    assert.match(html, /aria-expanded="false"[^>]*>↪ (?:<!-- -->)?1/);
    assert.doesNotMatch(html, /<form|301 →|Deleted/);
    const deleted = renderToString(createElement(components.PageList, { pages, showDeleted: true }));
    assert.match(deleted, /Удалена|Восстановить/);
    assert.doesNotThrow(() => renderToString(createElement(components.PageSettingsPage)));
});

test('settings form retains SEO tabs, inherited fields and external footer submission', () => {
    const html = renderToString(createElement(components.PageDetailsForm, {
        page: { id: 'page', title: 'About', path: '/about', type: 'standard', seo: { title: 'SEO About' } },
        formId: 'page-settings-form', hideActions: true, handleEscape: false,
    }));
    assert.match(html, /id="page-settings-form"/);
    assert.match(html, /SEO About/);
    assert.match(html, /Основное/);
    assert.match(html, /Внешний вид/);
    assert.doesNotMatch(html, /type="submit"/);
});

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
    const notificationOnly = renderToString(createElement(components.PaymentIntegrationEditor, { provider, settings: { payformDomain: '' }, validateRequired: false, onChange() {} }));
    assert.doesNotMatch(notificationOnly, /required/);
});

test('site settings expose a Payments route without a duplicate section menu and the payments page renders a loading state on SSR', () => {
    assert.equal(components.SITE_SETTINGS_SECTIONS.find(({ id }) => id === 'payments').path, '/admin/payments');
    const html = renderToString(createElement(components.SitePaymentsPage));
    assert.match(html, /Загрузка/);
    const layout = renderToString(createElement(components.SiteSettingsLayout, { section: 'payments', title: 'Платежи', status: 'success' }, createElement('p', null, 'Платёжные настройки')));
    assert.match(layout, /Платёжные настройки/);
    assert.doesNotMatch(layout, /Разделы настроек сайта/);
});

test('materials page renders on SSR without browser globals', () => {
    assert.doesNotThrow(() => renderToString(createElement(components.SiteMaterialsPage)));
});

test('list layouts keep compact titles and common states in the workspace without save footers', () => {
    for (const title of ['Материалы', 'Каталог', 'Заказы', 'Отзывы']) {
        for (const status of ['loading', 'error', 'success']) {
            const html = renderToString(createElement(components.AdminPageShell, {
                title, list: true, status, errorMessage: 'Ошибка загрузки', isDirty: true, onSave() {},
            }, 'Список'));
            assert.match(html, new RegExp(`<h1[^>]*>${title}</h1>`));
            assert.doesNotMatch(html, /<footer|Сохранить/);
            assert.ok(html.includes(status === 'loading' ? 'Загрузка' : status === 'error' ? 'Ошибка загрузки' : 'Список'));
        }
        const header = renderToString(createElement(components.AdminHeader, { title, list: true }));
        assert.doesNotMatch(header, /<h1/);
        assert.match(header, /Опубликовать|Предпросмотр/);
    }
    assert.match(renderToString(createElement(components.SiteReviewsPage)), /Загрузка/);
});

test('list pagination handles filtering, shrinking lists and page boundaries', () => {
    const seen = [];
    function Probe() {
        const [stage, setStage] = useState(0);
        const items = Array.from({ length: stage >= 3 ? 2 : 51 }, (_, index) => index);
        const page = components.useListPage(items, stage >= 2 ? 'filtered' : 'all');
        seen.push([page.pagination.page, page.items.length, page.pagination.hasNext]);
        if (stage === 0) { page.pagination.onChange(1); setStage(1); }
        if (stage === 1) setStage(2);
        if (stage === 2) { page.pagination.onChange(1); setStage(3); }
        return createElement(components.Pagination, page.pagination);
    }
    const html = renderToString(createElement(Probe));
    assert.deepEqual(seen, [[0, 50, true], [1, 1, false], [0, 50, true], [0, 2, false]]);
    assert.equal((html.match(/disabled/g) || []).length, 2);
});

test('catalog editor uses server-loaded list controls and pagination', () => {
    const html = renderToString(createElement(components.CatalogEditor));
    assert.match(html, /Разделы каталога/);
    assert.match(html, /Поиск/);
    assert.match(html, /Добавить товар\/услугу/);
    assert.match(html, /Загрузка товаров/);
    assert.doesNotMatch(html, /Позиция/);
    assert.doesNotMatch(html, /<footer/);
});

test('catalog without categories starts the uncategorized products request after category loading', async () => {
    assert.equal(components.catalogProductsCanLoad([], null), false);
    assert.equal(components.catalogProductsCanLoad([], '__uncategorized__'), true);
    assert.equal(components.catalogProductsCanLoad([{ id: 'category-a' }], 'category-a'), true);
    const source = await readFile(new URL('./CatalogEditor.jsx', import.meta.url), 'utf8');
    assert.match(source, /\}, \[categories\.length, activeCategoryId, selectedCategoryId/);
    assert.match(source, /productCount: item\.productCount/);
});

test('orders and payment result render without browser globals and orders have standard SPA navigation', () => {
    assert.match(renderToString(createElement(components.SiteOrdersPage)), /Загрузка/);
    assert.equal(renderToString(createElement(components.PaymentResult)), '');
    const sidebar = renderToString(createElement(components.AdminSidebar, { pathname: '/admin/orders' }));
    assert.match(sidebar, /href="\/admin\/orders"[^>]*aria-current="page"/);
});

test('admin sidebar renders on SSR and selects contacts by pathname', () => {
    const html = renderToString(createElement(components.AdminSidebar, { pathname: '/admin/contacts' }));

    assert.match(html, /href="\/admin\/contacts"[^>]*aria-current="page"/);
    assert.doesNotMatch(html, /\?section=/);
});

test('public product cards still render names, descriptions and ruble prices without purchase links', () => {
    const product = { id: 'product', name: 'Service', description: 'Description', price: '120.00', type: 'service', status: 'published' };
    const html = renderToString(createElement(components.ProductCards, { products: [product] }));
    assert.match(html, /Service/);
    assert.match(html, /Description/);
    assert.match(html, /120.00/);
    assert.match(html, /₽/);
    assert.doesNotMatch(html, /<a\b|Купить/);
    assert.match(renderToString(createElement(components.CatalogEditor)), /Загрузка товаров/);
    assert.doesNotMatch(renderToString(createElement(components.CatalogEditor, { value: { categories: [], products: [product] } })), /Service/);
});

test('product card shows Buy only with available payments and positive price; initial SSR stays identical without readiness', () => {
    const product = { id: 'id', name: 'Product', description: 'Description', price: '100.00', type: 'goods' };
    const enabled = renderToString(createElement(components.ProductCard, { product, paymentEnabled: true }));
    assert.match(enabled, /<button[^>]*>Купить<\/button>/);
    assert.doesNotMatch(renderToString(createElement(components.ProductCard, { product, paymentEnabled: false })), /Купить/);
    assert.doesNotMatch(renderToString(createElement(components.ProductCard, { product: { ...product, price: '0.00' }, paymentEnabled: true })), /Купить/);
    const props = { products: [product] };
    const initial = renderToString(createElement(components.ProductCards, props));
    assert.doesNotMatch(initial, /Купить/);
    assert.equal(renderToString(createElement(components.ProductCards, JSON.parse(JSON.stringify(props)))), initial);
});

test('admin password fields reveal only the saved-key indicator and never the stored secret', () => {
    const provider = describePaymentProvider(getPaymentProvider('prodamus'), { settings: { payformDomain: 'example.payform.ru', secretKey: 'PRIVATE_SENTINEL' } });
    const html = renderToString(createElement(components.PaymentIntegrationEditor, { provider, settings: provider.settings, onChange() {} }));
    assert.match(html, /type="password"/);
    assert.match(html, /Ключ сохранён/);
    assert.doesNotMatch(html, /PRIVATE_SENTINEL/);
});

test('saved-key deletion button is visible only for a configured key and requires confirmation', (t) => {
    const definition = getPaymentProvider('prodamus');
    const saved = describePaymentProvider(definition, { settings: { payformDomain: 'example.payform.ru', secretKey: 'PRIVATE_SENTINEL' } });
    const empty = describePaymentProvider(definition);
    let deletions = 0;
    const props = { settings: saved.settings, onChange() {}, onDeleteSecretKey() { deletions += 1; } };
    const button = descendants(components.PaymentIntegrationEditor({ ...props, provider: saved }))
        .find((element) => element.props?.children === 'Удалить секретный ключ');
    assert.ok(button);
    assert.equal(descendants(components.PaymentIntegrationEditor({ ...props, provider: empty }))
        .some((element) => element.props?.children === 'Удалить секретный ключ'), false);
    const previous = globalThis.window;
    t.after(() => { if (previous === undefined) delete globalThis.window; else globalThis.window = previous; });
    globalThis.window = { confirm: () => false };
    button.props.onClick();
    assert.equal(deletions, 0);
    globalThis.window.confirm = (message) => { assert.match(message, /отключена/); return true; };
    button.props.onClick();
    assert.equal(deletions, 1);
    const html = renderToString(createElement(components.PaymentIntegrationEditor, { ...props, provider: saved, disabled: true }));
    assert.match(html, /disabled[^>]*>Удалить секретный ключ/);
    assert.doesNotMatch(html, /PRIVATE_SENTINEL/);
});

test('action footer is absent without local actions and represents all form states', () => {
    assert.equal(renderToString(createElement(components.ActionFooter)), '');
    assert.equal(renderToString(createElement(components.ActionFooter, null, [])), '');
    assert.equal(renderToString(createElement(components.ActionFooter, null,
        createElement('button', { disabled: true }, 'Сохранить'))), '');
    assert.equal(renderToString(createElement(components.ActionFooter, null,
        createElement(Fragment, null, createElement('button', { disabled: true }, 'Сохранить')))), '');
    assert.equal(renderToString(createElement(components.ActionFooter, null,
        createElement('button', { 'aria-disabled': 'true' }, 'Сохранить'))), '');
    const mixed = renderToString(createElement(components.ActionFooter, null,
        createElement('button', { disabled: true }, 'Сохранить'),
        createElement('button', null, 'Удалить')));
    assert.match(mixed, /<footer/);
    assert.match(mixed, /Удалить/);
    assert.doesNotMatch(mixed, /Сохранить|disabled/);
    for (const [isDirty, saveStatus, label] of [[false, 'idle', 'Сохранено'], [true, 'idle', 'Есть несохранённые изменения'], [true, 'saving', 'Сохранение...'], [true, 'error', 'Ошибка сохранения'], [false, 'success', 'Сохранено']]) {
        const html = renderToString(createElement(components.ActionFooter, { isDirty, saveStatus }, createElement('button', null, 'Сохранить')));
        assert.match(html, /<footer/);
        assert.ok(html.includes(label));
    }
});

test('lists have no footer, settings have one save action enabled only for changes', () => {
    const render = (props) => renderToString(createElement(components.AdminPageShell, { status: 'success', ...props }, createElement('p', null, 'Контент')));
    assert.doesNotMatch(render({ title: 'Список' }), /<footer|Сохранить/);
    assert.doesNotMatch(render({ onSave() {} }), /<footer|Сохранить/);
    assert.doesNotMatch(render({ onSave() {}, isDirty: true, saveStatus: 'saving' }), /<footer|Сохранить/);
    const dirty = render({ onSave() {}, isDirty: true });
    assert.equal((dirty.match(/Сохранить/g) || []).length, 1);
    assert.doesNotMatch(dirty, /disabled/);
    assert.doesNotMatch(render({ title: 'Другой список' }), /<footer/);
});

test('page footer preserves main-page deletion restriction and has one Save button', () => {
    const props = { page: { id: 'page', title: 'Страница', path: '/' }, content: [], metadata: {}, parts: {}, widgets: {}, widgetMetadata: {}, loadStatus: 'success', saveStatus: 'idle', isDirty: true };
    const main = renderToString(createElement(components.AdminShell, props));
    assert.doesNotMatch(main, /> Удалить</);
    assert.equal((main.match(/> Сохранить</g) || []).length, 1);
    const ordinary = renderToString(createElement(components.AdminShell, { ...props, page: { ...props.page, path: '/other' } }));
    assert.match(ordinary, /> Удалить</);
    const savedMain = renderToString(createElement(components.AdminShell, { ...props, isDirty: false }));
    assert.doesNotMatch(savedMain, /<footer|> Сохранить</);
    const savedOrdinary = renderToString(createElement(components.AdminShell, { ...props, isDirty: false, page: { ...props.page, path: '/other' } }));
    assert.match(savedOrdinary, /> Удалить</);
    assert.doesNotMatch(savedOrdinary, /> Сохранить</);
    const saving = renderToString(createElement(components.AdminShell, { ...props, saveStatus: 'saving', page: { ...props.page, path: '/other' } }));
    assert.doesNotMatch(saving, /<footer|> Сохранить<|> Удалить</);
});

test('material actions never publish and do not offer deletion before creation', () => {
    const fresh = renderToString(createElement(components.MaterialActions, { dirty: true, saveStatus: 'idle' }));
    assert.doesNotMatch(fresh, /Удалить|Опубликовать/);
    assert.match(fresh, /form="material-form"/);
    const existing = renderToString(createElement(components.MaterialActions, { materialId: 'material', dirty: false, saveStatus: 'success' }));
    assert.match(existing, /Удалить/);
    assert.doesNotMatch(existing, /disabled|Сохранить/);
    assert.doesNotMatch(existing, /Опубликовать/);
    assert.equal(renderToString(createElement(components.MaterialActions, { dirty: false, saveStatus: 'idle' })), '');
    assert.equal(renderToString(createElement(components.MaterialActions, { materialId: 'material', dirty: true, saveStatus: 'saving' })), '');
});

test('header has global actions only and blocks publication while the current form is dirty or saving', () => {
    for (const props of [{ isDirty: true }, { saveStatus: 'saving' }]) {
        const html = renderToString(createElement(components.AdminHeader, props));
        assert.match(html, /Сначала сохраните изменения/);
        assert.match(html, /aria-label="Опубликовать"[^>]*disabled/);
        assert.doesNotMatch(html, /name="save"|>Сохранить</);
    }
    assert.doesNotMatch(renderToString(createElement(components.AdminHeader)), /Сначала сохраните изменения/);
});

test('auto-slug hook follows title changes, stops after manual editing, and resets for another object', () => {
    const seen = [];
    function Probe() {
        const [stage, setStage] = useState(0);
        const [title, setTitle] = useState('Первый материал');
        const [value, setValue] = useState('');
        const [identity, setIdentity] = useState('new-1');
        const { slug, changeSlug } = components.useAutoSlug({ title, value, onChange: setValue, identity });
        seen.push(slug);
        if (stage === 0) { setTitle('Второй материал'); setStage(1); }
        if (stage === 1) { changeSlug('manual-address'); setStage(2); }
        if (stage === 2) { setTitle('Третий материал'); setStage(3); }
        if (stage === 3) { setIdentity('new-2'); setValue(''); setTitle('Новый объект'); setStage(4); }
        return createElement('span', null, slug);
    }
    renderToString(createElement(Probe));
    assert.deepEqual(seen, ['pervyi-material', 'vtoroi-material', 'manual-address', 'manual-address', 'novyi-obekt']);
    function Existing() {
        const { slug } = components.useAutoSlug({ title: 'Новое название', value: 'existing-address', enabled: false });
        return createElement('span', null, slug);
    }
    assert.match(renderToString(createElement(Existing)), /existing-address/);
});
