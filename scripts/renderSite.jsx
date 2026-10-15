import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import Page from '../layout/Page.jsx';
import { parts } from '../dist/kroy/site-parts.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SITES_DIR = join(ROOT, 'dist', 'sites');
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function getOutputPath(siteDirectory, pagePath) {
    if (
        typeof pagePath !== 'string'
        || !pagePath.startsWith('/')
        || /[\s?#]/.test(pagePath)
    ) {
        throw new Error(`Некорректный путь страницы: ${pagePath}`);
    }

    const segments = pagePath === '/' ? [] : pagePath.slice(1).split('/');

    if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
        throw new Error(`Некорректный путь страницы: ${pagePath}`);
    }

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
        const markup = renderToStaticMarkup(
            <html lang="ru">
                <head>
                    <meta charSet="UTF-8" />
                    <title>{page.title}</title>
                </head>
                <body>
                    <Page content={page.content} parts={parts} />
                </body>
            </html>
        );

        return {
            path: getOutputPath(siteDirectory, page.path),
            html: `<!DOCTYPE html>${markup}`,
        };
    });

    await rm(siteDirectory, { recursive: true, force: true });

    for (const outputFile of outputFiles) {
        await mkdir(dirname(outputFile.path), { recursive: true });
        await writeFile(outputFile.path, outputFile.html);
        console.log(`Страница создана: ${outputFile.path}`);
    }
}
