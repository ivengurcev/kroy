import { readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import getActiveRelease from './getActiveRelease.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITES_DIR = join(ROOT, 'dist', 'sites');
const RELEASE_PATTERN = /^\d{17}$/;
const siteSlug = process.argv[2];

function formatReleaseDate(releaseId) {
    return `${releaseId.slice(0, 4)}-${releaseId.slice(4, 6)}-${releaseId.slice(6, 8)} `
        + `${releaseId.slice(8, 10)}:${releaseId.slice(10, 12)}:`
        + `${releaseId.slice(12, 14)}.${releaseId.slice(14)} UTC`;
}

try {
    if (!siteSlug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(siteSlug)) {
        throw new Error('Укажите корректный slug сайта: yarn site:releases <slug>');
    }

    const releases = (await readdir(join(SITES_DIR, siteSlug), {
        withFileTypes: true,
    }))
        .filter((entry) => entry.isDirectory() && RELEASE_PATTERN.test(entry.name))
        .map((entry) => entry.name)
        .sort()
        .reverse()
        .slice(0, 5);
    const activeRelease = await getActiveRelease(siteSlug);

    if (releases.length === 0) {
        console.log(`У сайта ${siteSlug} нет сохранённых релизов`);
    } else {
        for (const releaseId of releases) {
            const active = releaseId === activeRelease ? ' active' : '';
            console.log(`${releaseId}  ${formatReleaseDate(releaseId)}${active}`);
        }
    }
} catch (error) {
    if (error.code === 'ENOENT') {
        console.error(`У сайта ${siteSlug} нет сохранённых релизов`);
    } else {
        console.error(`Не удалось получить релизы: ${error.message}`);
    }
    process.exitCode = 1;
}
