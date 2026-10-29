import { dirname, join, resolve } from 'node:path';
import { copyFile, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { isValidPagePath } from '../api/pageFields.mjs';
import { pool } from '../db/client.mjs';
import { getThemeTokens } from '../themes/themeRegistry.mjs';
import { normalizeSiteContacts } from '../db/siteContacts.mjs';
import { getCatalog } from '../db/catalog.mjs';
import { getPublishedReviews } from '../db/reviews.mjs';
import { getMediaPath } from '../media/storage.mjs';
import generateSiteParts from './generateSiteParts.mjs';
import generateSiteRouting from './generateSiteRouting.mjs';
import createSiteCssModulesPlugin from './siteCssModulesPlugin.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CLIENT_ENTRY_PATH = join(ROOT, 'scripts', 'hydrateSite.jsx');
const DEFAULT_FAVICON_PATH = join(ROOT, 'design', 'oysite-brand-kit', 'icons', 'favicon.svg');
const SITE_PAGES_PATH = join(ROOT, 'dist', 'kroy', 'site-pages.mjs');
const SITE_THEME_PATH = join(ROOT, 'dist', 'kroy', 'site-theme.mjs');
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

async function collectFiles(directory, extension, files = []) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) await collectFiles(path, extension, files);
        else if (entry.name.endsWith(extension)) files.push(path);
    }
    return files;
}

async function validateStaticStyles(directory, assetBase, ssrMappings, clientMappings) {
    const cssPath = join(directory, 'assets', 'app.css');
    const css = await readFile(cssPath, 'utf8');
    if (!css.trim()) throw new Error('Клиентская таблица стилей app.css пуста.');

    const ssrModules = Object.fromEntries(ssrMappings);
    const clientModules = Object.fromEntries(clientMappings);
    const modulePaths = new Set([...Object.keys(ssrModules), ...Object.keys(clientModules)]);
    for (const modulePath of modulePaths) {
        const ssrModule = ssrModules[modulePath];
        const clientModule = clientModules[modulePath];
        if (!ssrModule || !clientModule) {
            throw new Error(`CSS Module ${modulePath} загружен только в одной сборке.`);
        }
        if (JSON.stringify(ssrModule) !== JSON.stringify(clientModule)) {
            throw new Error(`CSS Module ${modulePath} имеет разные имена классов в SSR и клиенте.`);
        }
    }

    const moduleClasses = new Set(
        Object.values(ssrModules).flatMap((mapping) => Object.values(mapping))
    );
    const selectors = new Set([...css.matchAll(/\.([A-Za-z_][\w-]*)/g)].map((match) => match[1]));
    const missingCss = [...moduleClasses].filter((className) => !selectors.has(className));
    if (missingCss.length) {
        throw new Error(`В app.css отсутствуют CSS Module классы: ${missingCss.join(', ')}`);
    }
    const htmlFiles = await collectFiles(directory, '.html');
    if (!htmlFiles.length) throw new Error('SSR не создал HTML-страницы сайта.');

    for (const htmlPath of htmlFiles) {
        const html = await readFile(htmlPath, 'utf8');
        if (!html.includes(`href="${assetBase}/app.css"`)) {
            throw new Error(`Страница ${htmlPath} не подключает assets/app.css.`);
        }
        const classes = [...html.matchAll(/class="([^"]*)"/g)]
            .flatMap((match) => match[1].split(/\s+/))
            .filter(Boolean);
        const missing = classes.filter(
            (className) => className.startsWith('kroy_') && !moduleClasses.has(className)
        );
        if (missing.length) {
            throw new Error(`В ${htmlPath} используются неизвестные CSS Module классы: ${[...new Set(missing)].join(', ')}`);
        }
    }
}
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
            `SELECT id, slug, name, theme_id, theme_mode, theme_overrides, contact_settings
             FROM sites
             WHERE slug = $1`,
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
    const theme = {
        mode: site.theme_mode,
        light: getThemeTokens(site.theme_id, 'light', site.theme_overrides),
        dark: getThemeTokens(site.theme_id, 'dark', site.theme_overrides),
    };
    await writeFile(
        SITE_THEME_PATH,
        `export const theme = ${JSON.stringify(theme)};\n`
    );
    await writeFile(
        join(ROOT, 'dist', 'kroy', 'site-contacts.mjs'),
        `export const contacts = ${JSON.stringify(normalizeSiteContacts(site.contact_settings))};\n`
    );
    const catalog = await getCatalog(site.id, { includeHidden: false });
    await writeFile(
        join(ROOT, 'dist', 'kroy', 'site-catalog.mjs'),
        `export const catalog = ${JSON.stringify(catalog)};\n`
    );
    const publishedReviews = await getPublishedReviews(site.id);
    const reviews = publishedReviews.map(({ mediaFilename, ...review }) => ({
        ...review,
        mediaUrl: mediaFilename ? `${ASSET_BASE}/reviews/${mediaFilename}` : null,
    }));
    await writeFile(
        join(ROOT, 'dist', 'kroy', 'site-reviews.mjs'),
        `export const reviews = ${JSON.stringify(reviews)};\n`
    );
    const ssrCssModules = createSiteCssModulesPlugin({ root: ROOT, emitCss: false });
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
            ...ASSET_LOADERS,
        },
        plugins: [ssrCssModules.plugin],
        assetNames: '[name]-[hash]',
        publicPath: ASSET_BASE,
    });

    const { default: renderSite } = await import(
        `${pathToFileURL(rendererPath).href}?${Date.now()}`
    );

    await renderSite(site, pages, temporaryDirectory, ASSET_BASE);
    await mkdir(join(temporaryDirectory, 'assets'), { recursive: true });
    await mkdir(join(temporaryDirectory, 'assets', 'reviews'), { recursive: true });
    for (const review of publishedReviews) {
        if (!review.mediaFilename) continue;
        const source = getMediaPath(site.id, review.mediaFilename);
        if (!source) throw new Error(`Некорректное изображение отзыва: ${review.mediaId}`);
        await copyFile(source, join(temporaryDirectory, 'assets', 'reviews', review.mediaFilename));
    }
    await copyFile(DEFAULT_FAVICON_PATH, join(temporaryDirectory, 'assets', 'favicon.svg'));
    const clientCssModules = createSiteCssModulesPlugin({ root: ROOT, emitCss: true });
    await build({
        entryPoints: [CLIENT_ENTRY_PATH],
        minify: true,
        outfile: join(temporaryDirectory, 'assets', 'app.js'),
        bundle: true,
        platform: 'browser',
        format: 'esm',
        jsx: 'automatic',
        loader: {
            ...ASSET_LOADERS,
        },
        plugins: [clientCssModules.plugin],
        assetNames: '[name]-[hash]',
        publicPath: ASSET_BASE,
        define: { 'process.env.NODE_ENV': '"production"' },
    });
    await validateStaticStyles(
        temporaryDirectory,
        ASSET_BASE,
        ssrCssModules.mappings,
        clientCssModules.mappings
    );
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
