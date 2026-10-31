import { dirname, join, resolve } from 'node:path';
import { copyFile, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build, transform } from 'esbuild';
import { isValidPagePath, isValidPageRoutePattern } from '../api/pageFields.mjs';
import { pool } from '../db/client.mjs';
import { getThemeTokens } from '../themes/themeRegistry.mjs';
import { normalizeSiteContacts } from '../db/siteContacts.mjs';
import { getCatalog } from '../db/catalog.mjs';
import { getPublishedReviews } from '../db/reviews.mjs';
import { getMediaPath } from '../media/storage.mjs';
import generateSiteParts from './generateSiteParts.mjs';
import generateSiteRouting from './generateSiteRouting.mjs';
import createSiteSvgPlugin from './siteSvgPlugin.mjs';
import { assertArticlePathsAvailable, createArticlePages } from './createArticlePages.mjs';
import { createClientPageRegistry } from './sitePageData.mjs';

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

function getCssModulePaths(metafile) {
    return Object.keys(metafile.inputs)
        .filter((path) => path.endsWith('.module.css'))
        .sort();
}

function getCssSelectors(css) {
    const selectors = css
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/url\([^)]*\)/g, '')
        .replace(/"(?:\\.|[^"\\])*"/g, '')
        .replace(/'(?:\\.|[^'\\])*'/g, '');
    return new Set([...selectors.matchAll(/\.([A-Za-z_][\w-]*)/g)].map((match) => match[1]));
}

async function validateStaticStyles(directory, assetBase, ssrCss, ssrMetafile, clientMetafile) {
    const cssPath = join(directory, 'assets', 'app.css');
    const css = await readFile(cssPath, 'utf8');
    if (!css.trim()) throw new Error('Клиентская таблица стилей app.css пуста.');
    if (css.includes(':global(')) {
        throw new Error('В app.css остались необработанные селекторы :global().');
    }

    const ssrModules = getCssModulePaths(ssrMetafile);
    const clientModules = getCssModulePaths(clientMetafile);
    if (JSON.stringify(ssrModules) !== JSON.stringify(clientModules)) {
        throw new Error('SSR и клиент загрузили разные наборы CSS Modules.');
    }

    const selectors = getCssSelectors(css);
    const missingSsrSelectors = [...getCssSelectors(ssrCss)].filter(
        (className) => !selectors.has(className)
    );
    if (missingSsrSelectors.length) {
        throw new Error(`В app.css отсутствуют SSR-селекторы: ${missingSsrSelectors.join(', ')}`);
    }

    const clientJs = await readFile(join(directory, 'assets', 'app.js'), 'utf8');
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
        const missingCss = classes.filter((className) => !selectors.has(className));
        if (missingCss.length) {
            throw new Error(`В app.css отсутствуют классы из ${htmlPath}: ${[...new Set(missingCss)].join(', ')}`);
        }
        const missingClient = classes.filter((className) => !clientJs.includes(className));
        if (missingClient.length) {
            throw new Error(`В app.js отсутствуют классы из ${htmlPath}: ${[...new Set(missingClient)].join(', ')}`);
        }
    }

    const rendererFiles = (await readdir(directory)).filter(
        (name) => name.startsWith('.site-renderer')
    );
    if (rendererFiles.length) {
        throw new Error(`В сборке остались временные SSR-файлы: ${rendererFiles.join(', ')}`);
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
    let allDetailTemplates;
    let detailTemplates;
    let publishedArticles;
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
            `SELECT id, site_id, path, title, content, page_type, route_param
             FROM pages
             WHERE site_id = $1
               AND deleted_at IS NULL
             ORDER BY path`,
            [site.id]
        );
        const detailTemplatesResult = await client.query(
            `SELECT detail.id, detail.path, detail.route_param, detail.content
             FROM pages detail
             JOIN pages list
               ON list.id = detail.detail_parent_id
              AND list.site_id = detail.site_id
             WHERE detail.site_id = $1
               AND detail.page_type = 'detail'
               AND detail.deleted_at IS NULL
               AND list.page_type = 'list'
               AND list.data_source = 'articles'
               AND list.deleted_at IS NULL
             ORDER BY detail.path`,
            [site.id],
        );
        const articlesResult = detailTemplatesResult.rows.length
            ? await client.query(
                `SELECT a.slug, a.title, a.summary, a.content, m.filename AS cover_filename
                 FROM articles a
                 LEFT JOIN media m ON m.id = a.cover_media_id AND m.site_id = a.site_id
                 WHERE a.site_id = $1 AND a.status = 'published'
                 ORDER BY a.slug`,
                [site.id],
            )
            : { rows: [] };
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
            `SELECT path, page_type
             FROM pages
             WHERE site_id = $1
               AND deleted_at IS NOT NULL
             ORDER BY path`,
            [site.id]
        );

        pages = pagesResult.rows.filter(({ page_type }) => page_type !== 'detail');
        allDetailTemplates = pagesResult.rows.filter(({ page_type }) => page_type === 'detail');
        detailTemplates = detailTemplatesResult.rows;
        publishedArticles = articlesResult.rows;
        redirects = redirectsResult.rows;
        deletedPages = deletedPagesResult.rows.filter(({ page_type }) => page_type !== 'detail');
        if (allDetailTemplates.some(({ path, route_param }) =>
            !isValidPageRoutePattern(path) || !path.endsWith(`/:${route_param}`)
        )) {
            throw new Error(`Сайт ${site.slug} содержит некорректный шаблон детального маршрута`);
        }

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

    const articleRecords = publishedArticles.map(({ cover_filename: coverFilename, ...article }) => ({
        ...article,
        coverUrl: coverFilename ? `${ASSET_BASE}/articles/${coverFilename}` : null,
    }));
    const articlePages = createArticlePages(detailTemplates, articleRecords);
    const articleTemplateIds = new Set(detailTemplates.map(({ id }) => id));
    assertArticlePathsAvailable(articlePages, [
        ...pages.map(({ path }) => path),
        ...redirects.map(({ from_path: path }) => path),
        ...deletedPages.map(({ path }) => path),
        ...allDetailTemplates.filter(({ id }) => !articleTemplateIds.has(id)).map(({ path }) => path),
    ]);
    const renderPages = [...pages, ...articlePages];

    const preparedDirectory = join(STAGING_DIR, site.slug);
    temporaryDirectory = join(STAGING_DIR, `${site.slug}.tmp`);
    const previousDirectory = join(STAGING_DIR, `${site.slug}.previous`);
    const rendererPath = join(temporaryDirectory, '.site-renderer.mjs');

    await rm(temporaryDirectory, { recursive: true, force: true });
    await mkdir(temporaryDirectory, { recursive: true });
    await generateSiteParts(renderPages, site.slug);
    const pageRegistry = createClientPageRegistry(renderPages);
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
    const ssrBuild = await build({
        entryPoints: [join(ROOT, 'scripts', 'renderSite.jsx')],
        outfile: rendererPath,
        bundle: true,
        minifySyntax: true,
        minifyWhitespace: true,
        minifyIdentifiers: false,
        packages: 'external',
        platform: 'node',
        format: 'esm',
        jsx: 'automatic',
        loader: {
            '.module.css': 'local-css',
            ...ASSET_LOADERS,
        },
        plugins: [createSiteSvgPlugin({ root: ROOT })],
        assetNames: '[name]-[hash]',
        publicPath: ASSET_BASE,
        metafile: true,
    });
    const ssrCssOutputs = Object.keys(ssrBuild.metafile.outputs).filter(
        (path) => path.endsWith('.css')
    );
    if (ssrCssOutputs.length !== 1) {
        throw new Error(`SSR создал неожиданное количество CSS-файлов: ${ssrCssOutputs.length}`);
    }
    const ssrCss = await readFile(resolve(ROOT, ssrCssOutputs[0]), 'utf8');

    const { default: renderSite } = await import(
        `${pathToFileURL(rendererPath).href}?${Date.now()}`
    );

    await renderSite(site, renderPages, temporaryDirectory, ASSET_BASE);
    await mkdir(join(temporaryDirectory, 'assets'), { recursive: true });
    await mkdir(join(temporaryDirectory, 'assets', 'reviews'), { recursive: true });
    for (const review of publishedReviews) {
        if (!review.mediaFilename) continue;
        const source = getMediaPath(site.id, review.mediaFilename);
        if (!source) throw new Error(`Некорректное изображение отзыва: ${review.mediaId}`);
        await copyFile(source, join(temporaryDirectory, 'assets', 'reviews', review.mediaFilename));
    }
    await mkdir(join(temporaryDirectory, 'assets', 'articles'), { recursive: true });
    const articleCoverFilenames = [...new Set(publishedArticles.map(({ cover_filename }) => cover_filename).filter(Boolean))];
    for (const filename of articleCoverFilenames) {
        const source = getMediaPath(site.id, filename);
        if (!source) throw new Error(`Некорректное изображение статьи: ${filename}`);
        await copyFile(source, join(temporaryDirectory, 'assets', 'articles', filename));
    }
    await copyFile(DEFAULT_FAVICON_PATH, join(temporaryDirectory, 'assets', 'favicon.svg'));
    const appJsPath = join(temporaryDirectory, 'assets', 'app.js');
    const clientBuild = await build({
        entryPoints: [CLIENT_ENTRY_PATH],
        minifySyntax: true,
        minifyWhitespace: true,
        minifyIdentifiers: false,
        outfile: appJsPath,
        bundle: true,
        platform: 'browser',
        format: 'esm',
        jsx: 'automatic',
        loader: {
            '.module.css': 'local-css',
            ...ASSET_LOADERS,
        },
        plugins: [createSiteSvgPlugin({ root: ROOT })],
        assetNames: '[name]-[hash]',
        publicPath: ASSET_BASE,
        define: { 'process.env.NODE_ENV': '"production"' },
        metafile: true,
    });
    const appJs = await readFile(appJsPath, 'utf8');
    const transformed = await transform(appJs, {
        loader: 'js',
        format: 'esm',
        minifySyntax: true,
        minifyWhitespace: true,
        minifyIdentifiers: true,
    });
    if (transformed.warnings.length) {
        throw new Error(`Минификация app.js завершилась с предупреждениями: ${transformed.warnings.map(({ text }) => text).join('; ')}`);
    }
    await writeFile(appJsPath, transformed.code);
    await validateStaticStyles(
        temporaryDirectory,
        ASSET_BASE,
        ssrCss,
        ssrBuild.metafile,
        clientBuild.metafile
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
