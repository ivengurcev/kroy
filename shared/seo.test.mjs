import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeSeo, resolvePageMeta, metaTags } from './seo.mjs';
import { createMaterialPages } from '../build/site/createMaterialPages.mjs';
import { createSitemap, createRobots } from '../build/site/seoFiles.mjs';
import { createClientPageRegistry, serializePagePayload } from '../build/site/sitePageData.mjs';
import updatePageMeta from '../site/runtime/updatePageMeta.mjs';

const asset = '/_kroy/releases/20261113000000000/assets/seo/site.webp';
const site = { name: 'Клиника', seo: { primaryDomain: 'clinic.example.org', description: 'Описание сайта', imageUrl: asset } };
const page = { title: 'О нас', path: '/about', content: [], seo: {} };
const template = { path: '/news/:slug', route_param: 'slug', materialSectionId: 'news', content: [] };
const material = { title: 'Новый материал', slug: 'new', summary: 'Краткое описание', coverUrl: asset.replace('site.webp', 'cover.webp'), status: 'published' };
const detail = () => createMaterialPages([template], { news: [material] })[0];
const resolved = (value) => ({ ...value, meta: resolvePageMeta(site, value) });

test('static page inherits site SEO without changing stored overrides', () => {
    const meta = resolvePageMeta(site, page);
    assert.equal(meta.title, 'О нас — Клиника');
    assert.equal(meta.description, site.seo.description);
    assert.equal(meta.image, `https://clinic.example.org${asset}`);
    assert.deepEqual(page.seo, {});
});
test('page SEO title replaces the template entirely', () => {
    assert.equal(resolvePageMeta(site, { ...page, seo: { title: 'Свой заголовок' } }).title, 'Свой заголовок');
});
test('template replacements preserve literal replacement characters in page names', () => {
    assert.equal(resolvePageMeta(site, { ...page, title: '$& {site}' }).title, '$& {site} — Клиника');
});
test('page description replaces the site default', () => {
    assert.equal(resolvePageMeta(site, { ...page, seo: { description: 'Своя' } }).description, 'Своя');
});
test('page image replaces the site default', () => {
    assert.equal(resolvePageMeta(site, { ...page, seo: { imageUrl: asset.replace('site', 'page') } }).image, `https://clinic.example.org${asset.replace('site', 'page')}`);
});
test('resolving a new build uses changed site defaults, not copied page data', () => {
    const changed = { ...site, seo: { ...site.seo, name: 'Новое имя', description: 'Новое описание', imageUrl: asset.replace('site', 'new') } };
    const meta = resolvePageMeta(changed, page);
    assert.equal(meta.title, 'О нас — Новое имя');
    assert.equal(meta.description, 'Новое описание');
    assert.notEqual(meta.image, resolvePageMeta(site, page).image);
    assert.deepEqual(page.seo, {});
});
test('material/product/review lists never derive SEO from cards', () => {
    for (const dataSource of ['materials', 'products', 'reviews']) {
        const meta = resolvePageMeta(site, { ...page, type: 'list', dataSource, materials: [material], products: [material], reviews: [material], seo: { title: 'Список', description: 'Описание списка' } });
        assert.equal(meta.title, 'Список');
        assert.equal(meta.description, 'Описание списка');
        assert.equal(meta.type, 'website');
    }
});
test('material detail uses title, summary, cover and article type', () => {
    const meta = resolvePageMeta(site, detail());
    assert.equal(meta.title, material.title);
    assert.equal(meta.description, material.summary);
    assert.equal(meta.image, `https://clinic.example.org${material.coverUrl}`);
    assert.equal(meta.type, 'article');
});
test('material without summary or cover inherits site defaults', () => {
    const current = detail();
    current.record.coverUrl = null;
    current.record.summary = '';
    const meta = resolvePageMeta(site, current);
    assert.equal(meta.image, `https://clinic.example.org${asset}`);
    assert.equal(meta.description, site.seo.description);
});
test('detail canonical and OG URL use resolved public path, never :slug', () => {
    const meta = resolvePageMeta(site, detail());
    assert.equal(meta.canonical, 'https://clinic.example.org/news/new');
    assert.deepEqual(metaTags(meta).find(([, key]) => key === 'og:url'), ['property', 'og:url', meta.canonical]);
    assert.equal(resolvePageMeta(site, { ...page, path: template.path }).canonical, null);
});
test('site noindex wins over an explicit page allow', () => {
    assert.equal(resolvePageMeta({ ...site, seo: { ...site.seo, indexable: false } }, { ...page, seo: { indexing: 'allow' } }).robots, 'noindex, follow');
});
test('sitemap excludes noindex pages and includes home and public lists/details', () => {
    const xml = createSitemap([resolved({ ...page, path: '/' }), resolved(page), resolved(detail()), resolved({ ...page, path: '/private', seo: { indexing: 'deny' } })]);
    assert.match(xml, /<loc>https:\/\/clinic.example.org\/<\/loc>/);
    assert.match(xml, /\/news\/new<\/loc>/);
    assert.doesNotMatch(xml, /private|lastmod|:slug/);
});
test('sitemap excludes deleted pages, drafts, admin URLs and dynamic templates', () => {
    const xml = createSitemap([resolved({ ...page, deleted_at: '2026-11-01' }), resolved({ ...detail(), record: { ...detail().record, status: 'draft' } }), resolved({ ...page, path: '/admin' }), resolved({ ...page, path: '/news/:slug' })]);
    assert.doesNotMatch(xml, /<url>/);
});
test('canonical and images are absolute on the primary domain; unsafe inputs omitted', () => {
    const meta = resolvePageMeta(site, page);
    for (const url of [meta.canonical, meta.image]) assert.equal(new URL(url).origin, 'https://clinic.example.org');
    for (const domain of ['localhost', 'demo.localhost', '127.0.0.1', 'x.internal', 'x.test', 'x.home.arpa', 'https://bad.org', 'bad.org/admin']) {
        assert.equal(resolvePageMeta({ ...site, seo: { ...site.seo, primaryDomain: domain } }, page).canonical, null);
    }
    assert.equal(resolvePageMeta(site, { ...page, seo: { imageUrl: '/api/media/private' } }).image, null);
});
test('empty images and descriptions produce no empty OG/Twitter tags', () => {
    const meta = resolvePageMeta({ name: 'Site', seo: { primaryDomain: 'example.org' } }, page);
    assert.ok(metaTags(meta).every(([, , value]) => value));
    assert.equal(metaTags(meta).some(([, key]) => key.endsWith(':image')), false);
});
test('same resolved metadata survives static registry and detail payload', () => {
    const current = resolved(page);
    assert.deepEqual(createClientPageRegistry([current])[page.path].meta, current.meta);
    const currentDetail = resolved(detail());
    assert.deepEqual(JSON.parse(serializePagePayload(currentDetail)).meta, currentDetail.meta);
    assert.deepEqual(createClientPageRegistry([currentDetail]), {});
});
test('SPA updates all managed tags without duplicates and removes absent images', () => {
    const nodes = [];
    const document = {
        head: { querySelectorAll: () => [...nodes], appendChild: (node) => nodes.push(node) },
        createElement: (tag) => ({ tag, attributes: {}, setAttribute(key, value) { this.attributes[key] = value; }, remove() { nodes.splice(nodes.indexOf(this), 1); } }),
    };
    updatePageMeta(resolvePageMeta(site, detail()), document);
    updatePageMeta(resolvePageMeta(site, page), document);
    updatePageMeta(resolvePageMeta(site, page), document);
    assert.equal(document.title, 'О нас — Клиника');
    const keys = nodes.map(({ attributes }) => attributes.property || attributes.name || attributes.rel);
    assert.equal(new Set(keys).size, keys.length);
    assert.equal(nodes.find(({ attributes }) => attributes.rel === 'canonical').attributes.href, 'https://clinic.example.org/about');
    updatePageMeta(resolvePageMeta({ name: 'No image', seo: { primaryDomain: 'example.org', indexable: false } }, page), document);
    assert.equal(nodes.some(({ attributes }) => attributes.property === 'og:image'), false);
    assert.equal(nodes.find(({ attributes }) => attributes.name === 'robots').attributes.content, 'noindex, follow');
});
test('robots allows crawlers to read noindex and points to sitemap', () => {
    const robots = createRobots('https://clinic.example.org');
    assert.match(robots, /Allow: \/\n/);
    assert.doesNotMatch(robots, /Disallow: \/\n/);
    assert.match(robots, /Sitemap: https:\/\/clinic.example.org\/sitemap.xml/);
});
test('SEO validation omits empty optional overrides and rejects malformed inputs', () => {
    assert.deepEqual(normalizeSeo({ title: ' ', description: '', imageId: null, indexing: 'inherit' }).seo, {});
    for (const value of [null, [], { title: 42 }, { imageId: 'x' }, { indexing: 'yes' }]) assert.ok(Object.keys(normalizeSeo(value).fields).length);
    for (const value of [{ indexable: 'yes' }, { primaryDomain: 'localhost' }, { titleTemplate: '{unknown}' }]) assert.ok(Object.keys(normalizeSeo(value, { site: true }).fields).length);
});
