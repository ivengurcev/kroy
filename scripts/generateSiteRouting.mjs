import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isValidPagePath } from '../api/pageFields.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_DIR = join(ROOT, 'dist', 'kroy', 'routing');

export default async function generateSiteRouting(siteSlug, redirects, deletedPages) {
    const paths = [
        ...redirects.flatMap(({ from_path: from, path }) => [from, path]),
        ...deletedPages.map(({ path }) => path),
    ];

    if (paths.some((path) => !isValidPagePath(path))) {
        throw new Error(`Некорректный публичный путь сайта ${siteSlug}`);
    }

    const activeRedirects = redirects
        .filter(({ deleted_at: deletedAt }) => deletedAt === null)
        .map(({ from_path: from, path: to }) => ({ from, to, status: 301 }))
        .sort((a, b) => a.from < b.from ? -1 : a.from > b.from ? 1 : 0);
    const gone = [...new Set([
        ...redirects
            .filter(({ deleted_at: deletedAt }) => deletedAt !== null)
            .map(({ from_path: from }) => from),
        ...deletedPages.map(({ path }) => path),
    ])].sort();
    const outputPath = join(OUTPUT_DIR, `${siteSlug}.json`);

    await mkdir(OUTPUT_DIR, { recursive: true });
    await writeFile(
        outputPath,
        `${JSON.stringify({ redirects: activeRedirects, gone }, null, 2)}\n`
    );

    console.log(`Созданы правила маршрутизации сайта: ${outputPath}`);
}
