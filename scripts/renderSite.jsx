import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { renderToString } from 'react-dom/server';
import { isValidPagePath } from '../api/pageFields.mjs';
import SiteApp from '../layout/SiteApp.jsx';
import { parts } from '../dist/kroy/site-parts.mjs';
import { pages as pageRegistry } from '../dist/kroy/site-pages.mjs';

const DIST_DIR = resolve('dist');
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
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

export default async function renderSite(site, pages, outputDirectory) {
    if (!SLUG_PATTERN.test(site.slug)) {
        throw new Error(`Некорректный slug сайта: ${site.slug}`);
    }

    const siteDirectory = resolve(outputDirectory);

    if (!siteDirectory.startsWith(`${DIST_DIR}${sep}`)) {
        throw new Error(`Каталог сайта выходит за dist: ${site.slug}`);
    }

    const outputFiles = pages.map((page) => {
        const markup = renderToString(
            <html lang="ru">
                <head>
                    <meta charSet="UTF-8" />
                    <title>{page.title}</title>
                    <link rel="stylesheet" href="/assets/app.css" />
                </head>
                <body>
                    <div id="root">
                        <SiteApp
                            pages={pageRegistry}
                            path={page.path}
                            parts={parts}
                        />
                    </div>
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
