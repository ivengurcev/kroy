import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../../db/client.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));

test('static site build preserves list summaries, linked routes, covers and CSS without publishing drafts or full text to app.js', async (t) => {
    const slug = `test-article-list-${randomUUID()}`;
    const siteId = randomUUID();
    const coverFilename = `${randomUUID()}.png`;
    const mediaDirectory = join(root, 'data', 'media', siteId);
    const staging = join(root, 'dist', 'kroy', 'staging', slug);
    const generatedPaths = ['parts', 'pages', 'theme', 'contacts', 'catalog', 'reviews'].map((name) => join(root, 'dist', 'kroy', `site-${name}.mjs`));
    const backups = await Promise.all(generatedPaths.map((path) => readFile(path).catch((error) => { if (error.code !== 'ENOENT') throw error; return null; })));
    t.after(async () => {
        await Promise.all([
            rm(mediaDirectory, { recursive: true, force: true }),
            ...[staging, `${staging}.tmp`, `${staging}.previous`].map((path) => rm(path, { recursive: true, force: true })),
            ...generatedPaths.map((path, index) => backups[index] === null ? rm(path, { force: true }) : writeFile(path, backups[index])),
        ]);
    });
    await mkdir(mediaDirectory, { recursive: true });
    const coverBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jN3sAAAAASUVORK5CYII=', 'base64');
    await writeFile(join(mediaDirectory, coverFilename), coverBytes);
    const listContent = [{ part: '@kroy/article-list', props: {}, view: { name: '@kroy/article-cards', props: {} } }];
    const productId = randomUUID();
    const articleContent = [{ part: '@kroy/article', props: {}, view: { name: '@kroy/article-content', props: {} } }];
    let withoutTemplate = false;
    const allTemplates = [
        { id: 'news-detail', path: '/news/:articleId', route_param: 'articleId', detailParentId: 'news', content: articleContent },
        { id: 'root-detail', path: '/:entry', route_param: 'entry', detailParentId: 'home', content: articleContent },
    ];
    const rows = [
        { id: 'home', path: '/', title: 'Articles', type: 'list', dataSource: 'articles', content: listContent },
        { id: 'news', path: '/news', title: 'News', type: 'list', dataSource: 'articles', content: listContent },
        { id: 'no-template', path: '/read', title: 'Read', type: 'list', dataSource: 'articles', content: listContent },
        { id: 'catalog', path: '/catalog', title: 'Catalog', type: 'standard', content: [{ part: '@kroy/product-selection', props: { productIds: [productId] }, view: { name: '@kroy/product-selection', props: {} } }] },
        { id: 'about', path: '/about', title: 'About', type: 'standard', content: [] },
        ...allTemplates.map((template) => ({ ...template, type: 'detail' })),
    ];
    async function query(sql, values) {
        if (sql.startsWith('BEGIN') || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] };
        if (sql.includes('FROM sites')) return { rows: [{ id: siteId, slug, name: 'Build fixture', theme_id: 'calm', theme_mode: 'light', theme_overrides: {}, contact_settings: {} }] };
        assert.equal(values[0], siteId);
        if (sql.includes('FROM domains')) return { rows: [{ hostname: 'fixture.localhost' }] };
        if (sql.includes('FROM pages detail')) return { rows: withoutTemplate ? [] : allTemplates };
        if (sql.includes('FROM pages') && sql.includes('deleted_at IS NULL')) return { rows: withoutTemplate ? rows.filter((page) => page.type !== 'detail') : rows };
        if (sql.includes('FROM articles a')) {
            assert.match(sql, /a.status = 'published'/);
            assert.equal(sql.includes('a.content,'), !withoutTemplate);
            const articles = [
                { slug: 'example', title: 'Published fixture', summary: 'Short fixture', status: 'published', cover_filename: coverFilename },
                { slug: 'draft', title: 'DRAFT_SENTINEL', status: 'draft' },
            ];
            return { rows: articles.filter((article) => article.status === 'published').map((article) => ({
                ...article,
                ...(!withoutTemplate ? { content: { root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text: 'FULL_ARTICLE_BODY_SENTINEL' }] }] } } } : {}),
            })) };
        }
        if (sql.includes('FROM products')) return { rows: [{ id: productId, name: 'Public product', description: 'Product description', price: '100.00', type: 'service', status: 'published' }] };
        if (sql.includes('FROM redirects') || sql.includes('deleted_at IS NOT NULL') || sql.includes('FROM product_') || sql.includes('FROM products') || sql.includes('FROM reviews')) return { rows: [] };
        throw new Error('Unexpected build SQL: ' + sql);
    }
    t.mock.method(pool, 'query', query);
    t.mock.method(pool, 'connect', async () => ({ query, release() {} }));
    t.mock.method(pool, 'end', async () => {});
    const previousArgument = process.argv[2];
    const previousExitCode = process.exitCode;
    t.after(() => {
        if (previousArgument === undefined) process.argv.splice(2, 1);
        else process.argv[2] = previousArgument;
        process.exitCode = previousExitCode;
    });
    const previousSys = process.env.PRODAMUS_SYS;
    process.env.PRODAMUS_SYS = 'PRIVATE_SYS_SENTINEL';
    t.after(() => { if (previousSys === undefined) delete process.env.PRODAMUS_SYS; else process.env.PRODAMUS_SYS = previousSys; });
    process.argv[2] = slug;
    for (const noTemplate of [false, true]) {
        withoutTemplate = noTemplate;
        await import(new URL(`./buildSite.mjs?fixture=${randomUUID()}`, import.meta.url));
        assert.notEqual(process.exitCode, 1);
        const html = await readFile(join(staging, 'news', 'index.html'), 'utf8');
        const rootHtml = await readFile(join(staging, 'index.html'), 'utf8');
        const app = await readFile(join(staging, 'assets', 'app.js'), 'utf8');
        const registrySource = await readFile(join(root, 'dist', 'kroy', 'site-pages.mjs'), 'utf8');
        assert.match(html, /Published fixture/);
        assert.match(html, /Short fixture/);
        assert.doesNotMatch(html, /FULL_ARTICLE_BODY_SENTINEL|DRAFT_SENTINEL/);
        assert.equal(html.includes('href="/news/example"'), !withoutTemplate);
        assert.equal(rootHtml.includes('href="/example"'), !withoutTemplate);
        assert.doesNotMatch(await readFile(join(staging, 'read', 'index.html'), 'utf8'), /Читать/);
        assert.match(app, /Published fixture/);
        assert.ok(app.includes('/api/payments/status'));
        assert.ok(app.includes('/api/payments/start'));
        assert.doesNotMatch(app, /PRIVATE_SYS_SENTINEL|PRIVATE_MERCHANT_KEY/);
        const catalogHtml = await readFile(join(staging, 'catalog', 'index.html'), 'utf8');
        assert.match(catalogHtml, /Public product/);
        assert.doesNotMatch(catalogHtml, /Купить|PRIVATE_SYS_SENTINEL|PRIVATE_MERCHANT_KEY/);
        assert.doesNotMatch(app, /FULL_ARTICLE_BODY_SENTINEL|DRAFT_SENTINEL/);
        assert.doesNotMatch(registrySource, /FULL_ARTICLE_BODY_SENTINEL|DRAFT_SENTINEL/);
        const registry = JSON.parse(registrySource.slice('export const pages = '.length).trim().slice(0, -1));
        assert.equal(registry['/news'].articles.items.length, 1);
        assert.equal(registry['/about'].articles, undefined);
        assert.deepEqual(await readFile(join(staging, 'assets', 'articles', coverFilename)), coverBytes);
        if (!withoutTemplate) assert.match(await readFile(join(staging, 'news', 'example', 'index.html'), 'utf8'), /FULL_ARTICLE_BODY_SENTINEL/);
    }
});
