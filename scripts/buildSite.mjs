import { dirname, join, resolve } from 'node:path';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { isValidPagePath } from '../api/pageFields.mjs';
import { pool } from '../db/client.mjs';
import generateSiteParts from './generateSiteParts.mjs';
import generateSiteRouting from './generateSiteRouting.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CLIENT_ENTRY_PATH = join(ROOT, 'scripts', 'hydrateSite.jsx');
const SITE_PAGES_PATH = join(ROOT, 'dist', 'kroy', 'site-pages.mjs');
const STAGING_DIR = join(ROOT, 'dist', 'kroy', 'staging');
const ASSET_BASE = '/_kroy/releases/__KROY_RELEASE__/assets';
const SITE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ASSET_LOADERS = {
    '.png': 'file',
    '.jpg': 'file',
    '.jpeg': 'file',
    '.webp': 'file',
    '.svg': 'file',
    '.gif': 'file',
    '.avif': 'file',
    '.woff': 'file',
    '.woff2': 'file',
    '.ttf': 'file',
    '.otf': 'file',
};
const siteSlug = process.argv[2];
let client;
let temporaryDirectory;

try {
    if (!siteSlug) {
        throw new Error('Укажите slug сайта: yarn site:build <slug>');
    }

    let site;
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
    if (!SITE_SLUG_PATTERN.test(site.slug)) {
        throw new Error(`Некорректный slug сайта: ${site.slug}`);
    }

    const preparedDirectory = join(STAGING_DIR, site.slug);
    temporaryDirectory = join(STAGING_DIR, `${site.slug}.tmp`);
    const previousDirectory = join(STAGING_DIR, `${site.slug}.previous`);
    const rendererPath = join(temporaryDirectory, '.site-renderer.mjs');

    await rm(temporaryDirectory, { recursive: true, force: true });
    await mkdir(temporaryDirectory, { recursive: true });
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
        outfile: rendererPath,
        bundle: true,
        minify: true,
        packages: 'external',
        platform: 'node',
        format: 'esm',
        jsx: 'automatic',
        loader: {
            '.css': 'empty',
            '.module.css': 'local-css',
            ...ASSET_LOADERS,
        },
        assetNames: '[name]-[hash]',
        publicPath: ASSET_BASE,
    });

    const { default: renderSite } = await import(
        `${pathToFileURL(rendererPath).href}?${Date.now()}`
    );

    await renderSite(site, pages, temporaryDirectory, ASSET_BASE);
    await build({
        entryPoints: [CLIENT_ENTRY_PATH],
        minify: true,
        outfile: join(temporaryDirectory, 'assets', 'app.js'),
        bundle: true,
        platform: 'browser',
        format: 'esm',
        jsx: 'automatic',
        loader: {
            '.module.css': 'local-css',
            ...ASSET_LOADERS,
        },
        assetNames: '[name]-[hash]',
        publicPath: ASSET_BASE,
        define: { 'process.env.NODE_ENV': '"production"' },
    });
    await generateSiteRouting(
        site.slug,
        redirects,
        deletedPages,
        join(temporaryDirectory, 'routing.json')
    );

    await rm(previousDirectory, { recursive: true, force: true });
    let previousMoved = false;

    try {
        await rename(preparedDirectory, previousDirectory);
        previousMoved = true;
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
    }

    try {
        await rename(temporaryDirectory, preparedDirectory);
        temporaryDirectory = undefined;
    } catch (error) {
        if (previousMoved) {
            await rename(previousDirectory, preparedDirectory);
        }
        throw error;
    }

    await rm(previousDirectory, { recursive: true, force: true });
    console.log(`Подготовлена версия сайта: ${preparedDirectory}`);
} catch (error) {
    if (temporaryDirectory) {
        await rm(temporaryDirectory, { recursive: true, force: true });
    }
    console.error(`Не удалось собрать сайт: ${error.message}`);
    process.exitCode = 1;
} finally {
    client?.release();
    await pool.end();
}
