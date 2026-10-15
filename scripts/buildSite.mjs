import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { isValidPagePath } from '../api/pageFields.mjs';
import { pool } from '../db/client.mjs';
import generateCaddyConfig from './generateCaddyConfig.mjs';
import generateSiteParts from './generateSiteParts.mjs';
import generateSiteRouting from './generateSiteRouting.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RENDERER_PATH = join(ROOT, 'dist', 'kroy', 'site-renderer.mjs');
const siteSlug = process.argv[2];

try {
    if (!siteSlug) {
        throw new Error('Укажите slug сайта: yarn site:build <slug>');
    }

    const siteResult = await pool.query(
        'SELECT id, slug, name FROM sites WHERE slug = $1',
        [siteSlug]
    );
    const site = siteResult.rows[0];

    if (!site) {
        throw new Error(`Сайт не найден: ${siteSlug}`);
    }

    const pagesResult = await pool.query(
        `SELECT id, site_id, path, title, content
         FROM pages
         WHERE site_id = $1
           AND deleted_at IS NULL
         ORDER BY path`,
        [site.id]
    );
    const redirectsResult = await pool.query(
        `SELECT r.from_path, p.path, p.deleted_at
         FROM redirects r
         JOIN pages p
           ON p.id = r.page_id
          AND p.site_id = r.site_id
         WHERE r.site_id = $1
         ORDER BY r.from_path`,
        [site.id]
    );
    const deletedPagesResult = await pool.query(
        `SELECT path
         FROM pages
         WHERE site_id = $1
           AND deleted_at IS NOT NULL
         ORDER BY path`,
        [site.id]
    );
    const publicPaths = [
        ...pagesResult.rows.map(({ path }) => path),
        ...redirectsResult.rows.flatMap(
            ({ from_path: from, path }) => [from, path]
        ),
        ...deletedPagesResult.rows.map(({ path }) => path),
    ];

    if (publicPaths.some((path) => !isValidPagePath(path))) {
        throw new Error(`Сайт ${site.slug} содержит некорректный публичный путь`);
    }

    await generateSiteParts(pagesResult.rows, site.slug);
    await build({
        entryPoints: [join(ROOT, 'scripts', 'renderSite.jsx')],
        outfile: RENDERER_PATH,
        bundle: true,
        packages: 'external',
        platform: 'node',
        format: 'esm',
        jsx: 'automatic',
    });

    const { default: renderSite } = await import(
        `${pathToFileURL(RENDERER_PATH).href}?${Date.now()}`
    );

    await renderSite(site, pagesResult.rows);
    await generateSiteRouting(
        site.slug,
        redirectsResult.rows,
        deletedPagesResult.rows
    );
    await generateCaddyConfig(site.slug);
} catch (error) {
    console.error(`Не удалось собрать сайт: ${error.message}`);
    process.exitCode = 1;
} finally {
    await pool.end();
}
