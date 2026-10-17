import { dirname, join, resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { isValidPagePath } from '../api/pageFields.mjs';
import { pool } from '../db/client.mjs';
import generateCaddyConfig from './generateCaddyConfig.mjs';
import generateSiteParts from './generateSiteParts.mjs';
import generateSiteRouting from './generateSiteRouting.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RENDERER_PATH = join(ROOT, 'dist', 'kroy', 'site-renderer.mjs');
const CLIENT_ENTRY_PATH = join(ROOT, 'scripts', 'hydrateSite.jsx');
const SITE_PAGES_PATH = join(ROOT, 'dist', 'kroy', 'site-pages.mjs');
const siteSlug = process.argv[2];
let client;

try {
    if (!siteSlug) {
        throw new Error('Укажите slug сайта: yarn site:build <slug>');
    }

    let site;
    let domains;
    let pages;
    let redirects;
    let deletedPages;
    let transactionStarted = false;

    client = await pool.connect();

    try {
        await client.query(
            'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY'
        );
        transactionStarted = true;

        const siteResult = await client.query(
            'SELECT id, slug, name FROM sites WHERE slug = $1',
            [siteSlug]
        );
        site = siteResult.rows[0];

        if (!site) {
            throw new Error(`Сайт не найден: ${siteSlug}`);
        }

        const domainsResult = await client.query(
            `SELECT hostname
             FROM domains
             WHERE site_id = $1
             ORDER BY hostname`,
            [site.id]
        );

        if (domainsResult.rows.length === 0) {
            throw new Error(`У сайта ${site.slug} нет доменов`);
        }

        const pagesResult = await client.query(
            `SELECT id, site_id, path, title, content
             FROM pages
             WHERE site_id = $1
               AND deleted_at IS NULL
             ORDER BY path`,
            [site.id]
        );
        const redirectsResult = await client.query(
            `SELECT r.from_path, p.path, p.deleted_at
             FROM redirects r
             JOIN pages p
               ON p.id = r.page_id
              AND p.site_id = r.site_id
             WHERE r.site_id = $1
             ORDER BY r.from_path`,
            [site.id]
        );
        const deletedPagesResult = await client.query(
            `SELECT path
             FROM pages
             WHERE site_id = $1
               AND deleted_at IS NOT NULL
             ORDER BY path`,
            [site.id]
        );

        domains = domainsResult.rows;
        pages = pagesResult.rows;
        redirects = redirectsResult.rows;
        deletedPages = deletedPagesResult.rows;

        await client.query('COMMIT');
        transactionStarted = false;
    } catch (error) {
        if (transactionStarted) {
            await client.query('ROLLBACK').catch(() => {});
        }

        throw error;
    } finally {
        client.release();
        client = undefined;
    }

    const publicPaths = [
        ...pages.map(({ path }) => path),
        ...redirects.flatMap(
            ({ from_path: from, path }) => [from, path]
        ),
        ...deletedPages.map(({ path }) => path),
    ];

    if (publicPaths.some((path) => !isValidPagePath(path))) {
        throw new Error(`Сайт ${site.slug} содержит некорректный публичный путь`);
    }

    await generateSiteParts(pages, site.slug);
    const pageRegistry = Object.fromEntries(
        pages.map(({ path, title, content }) => [path, { path, title, content }])
    );
    await writeFile(
        SITE_PAGES_PATH,
        `export const pages = ${JSON.stringify(pageRegistry)};\n`
    );
    await build({
        entryPoints: [join(ROOT, 'scripts', 'renderSite.jsx')],
        outfile: RENDERER_PATH,
        bundle: true,
        packages: 'external',
        platform: 'node',
        format: 'esm',
        jsx: 'automatic',
        loader: { '.css': 'empty' },
    });

    const { default: renderSite } = await import(
        `${pathToFileURL(RENDERER_PATH).href}?${Date.now()}`
    );

    await renderSite(site, pages);
    await build({
        entryPoints: [CLIENT_ENTRY_PATH],
        minify: true,
        outfile: join(ROOT, 'dist', 'sites', site.slug, 'assets', 'app.js'),
        bundle: true,
        platform: 'browser',
        format: 'esm',
        jsx: 'automatic',
        define: { 'process.env.NODE_ENV': '"production"' },
    });
    await generateSiteRouting(
        site.slug,
        redirects,
        deletedPages
    );
    await generateCaddyConfig(
        site.slug,
        domains.map(({ hostname }) => hostname)
    );
} catch (error) {
    console.error(`Не удалось собрать сайт: ${error.message}`);
    process.exitCode = 1;
} finally {
    client?.release();
    await pool.end();
}
