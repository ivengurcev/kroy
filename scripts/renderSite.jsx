import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderToString } from 'react-dom/server';
import { isValidPagePath } from '../api/pageFields.mjs';
import SiteApp from '../layout/SiteApp.jsx';
import { parts } from '../dist/kroy/site-parts.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SITES_DIR = join(ROOT, 'dist', 'sites');
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const JSON_ESCAPE_PATTERN = /[<>&\u2028\u2029]/g;
const JSON_ESCAPES = {
    '<': '\\u003c',
    '>': '\\u003e',
    '&': '\\u0026',
    '\u2028': '\\u2028',
    '\u2029': '\\u2029',
};

function serializePage(page) {
    return JSON.stringify(page).replace(
        JSON_ESCAPE_PATTERN,
        (character) => JSON_ESCAPES[character]
    );
}

function getOutputPath(siteDirectory, pagePath) {
    if (!isValidPagePath(pagePath)) {
        throw new Error(`Некорректный путь страницы: ${pagePath}`);
    }

    const segments = pagePath === '/' ? [] : pagePath.slice(1).split('/');

    const outputPath = resolve(siteDirectory, ...segments, 'index.html');

    if (!outputPath.startsWith(`${siteDirectory}${sep}`)) {
        throw new Error(`Путь страницы выходит за каталог сайта: ${pagePath}`);
    }

    return outputPath;
}

export default async function renderSite(site, pages) {
    if (!SLUG_PATTERN.test(site.slug)) {
        throw new Error(`Некорректный slug сайта: ${site.slug}`);
    }

    const siteDirectory = resolve(SITES_DIR, site.slug);

    if (!siteDirectory.startsWith(`${SITES_DIR}${sep}`)) {
        throw new Error(`Каталог сайта выходит за dist/sites: ${site.slug}`);
    }

    const outputFiles = pages.map((page) => {
        const markup = renderToString(
            <html lang="ru">
                <head>
                    <meta charSet="UTF-8" />
                    <title>{page.title}</title>
                </head>
                <body>
                    <div id="root">
                        <SiteApp page={page} parts={parts} />
                    </div>
                    <script
                        id="kroy-page-data"
                        type="application/json"
                        dangerouslySetInnerHTML={{ __html: serializePage(page) }}
                    />
                    <script type="module" src="/assets/app.js" />
                </body>
            </html>
        );

        return {
            path: getOutputPath(siteDirectory, page.path),
            html: `<!DOCTYPE html>${markup}`,
        };
    });

    await mkdir(siteDirectory, { recursive: true });

    for (const entry of await readdir(siteDirectory)) {
        await rm(join(siteDirectory, entry), { recursive: true, force: true });
    }

    for (const outputFile of outputFiles) {
        await mkdir(dirname(outputFile.path), { recursive: true });
        await writeFile(outputFile.path, outputFile.html);
        console.log(`Страница создана: ${outputFile.path}`);
    }
}
