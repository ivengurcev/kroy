import { execFile } from 'node:child_process';
import {
    cp,
    mkdir,
    readFile,
    readdir,
    rename,
    rm,
    writeFile,
} from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { pool } from '../db/client.mjs';
import generateNginxConfig from './generateNginxConfig.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const STAGING_DIR = join(ROOT, 'dist', 'kroy', 'staging');
const SITES_DIR = join(ROOT, 'dist', 'sites');
const NGINX_DIR = join(ROOT, 'dist', 'kroy', 'nginx');
const RELEASE_PATTERN = /^\d{17}$/;
const RELEASE_MARKER = '__KROY_RELEASE__';
const TEXT_EXTENSIONS = new Set(['.html', '.js', '.css']);
const execFileAsync = promisify(execFile);
const siteSlug = process.argv[2];
const ALREADY_PUBLISHED = 'ALREADY_PUBLISHED';

async function readOptional(path) {
    try {
        return await readFile(path);
    } catch (error) {
        if (error.code === 'ENOENT') return undefined;
        throw error;
    }
}

async function restoreFile(path, content) {
    if (content === undefined) {
        await rm(path, { force: true });
        return;
    }

    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content);
}

async function versionAssets(directory, releaseId) {
    let replacements = 0;

    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);

        if (entry.isDirectory()) {
            replacements += await versionAssets(path, releaseId);
        } else if (TEXT_EXTENSIONS.has(extname(entry.name))) {
            const source = await readFile(path, 'utf8');
            const output = source.replaceAll(RELEASE_MARKER, releaseId);

            if (output !== source) {
                await writeFile(path, output);
                replacements += 1;
            }
        }
    }

    return replacements;
}

async function reloadNginx() {
    await execFileAsync(process.env.NGINX_BIN || 'nginx', ['-s', 'reload', '-c', join(NGINX_DIR, 'nginx.conf')], { cwd: ROOT });
}

let client;
let temporaryDirectory;
let releaseDirectory;
let publishedMarkerPath;
let published = false;

try {
    if (!siteSlug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(siteSlug)) {
        throw new Error('Укажите корректный slug сайта: yarn site:publish <slug>');
    }

    const stagingDirectory = join(STAGING_DIR, siteSlug);
    const routingPath = join(stagingDirectory, 'routing.json');
    publishedMarkerPath = join(stagingDirectory, '.published');
    await readFile(routingPath);

    if (await readOptional(publishedMarkerPath)) {
        const error = new Error(`Подготовленная версия ${siteSlug} уже опубликована`);
        error.code = ALREADY_PUBLISHED;
        throw error;
    }

    client = await pool.connect();
    const siteResult = await client.query(
        `SELECT s.id, array_agg(d.hostname ORDER BY d.hostname) AS domains
         FROM sites s
         JOIN domains d ON d.site_id = s.id
         WHERE s.slug = $1
         GROUP BY s.id`,
        [siteSlug]
    );
    const site = siteResult.rows[0];

    if (!site) {
        throw new Error(`Сайт или его домены не найдены: ${siteSlug}`);
    }

    client.release();
    client = undefined;

    const releaseId = new Date().toISOString().replace(/[-:.TZ]/g, '');
    const siteDirectory = join(SITES_DIR, siteSlug);
    releaseDirectory = join(siteDirectory, releaseId);
    temporaryDirectory = `${releaseDirectory}.tmp`;

    await mkdir(siteDirectory, { recursive: true });
    await cp(stagingDirectory, temporaryDirectory, {
        recursive: true,
        errorOnExist: true,
        force: false,
    });

    if (await versionAssets(temporaryDirectory, releaseId) === 0) {
        throw new Error('Подготовленная версия устарела; повторите site:build');
    }

    await rename(temporaryDirectory, releaseDirectory);
    temporaryDirectory = undefined;

    const configPath = join(NGINX_DIR, 'nginx.conf');
    const fragmentPath = join(NGINX_DIR, `${siteSlug}.conf`);
    const previousConfig = await readOptional(configPath);
    const previousFragment = await readOptional(fragmentPath);

    try {
        await generateNginxConfig(siteSlug, site.domains, {
            routingPath: join(releaseDirectory, 'routing.json'),
            siteRoot: `${siteSlug}/${releaseId}`,
            releaseId,
        });
        await reloadNginx();
        await writeFile(publishedMarkerPath, `${releaseId}\n`);
    } catch (error) {
        await restoreFile(configPath, previousConfig);
        await restoreFile(fragmentPath, previousFragment);
        await reloadNginx().catch(() => {});
        throw error;
    }

    published = true;
    const releases = (await readdir(siteDirectory, { withFileTypes: true }))
        .filter((entry) => entry.isDirectory() && RELEASE_PATTERN.test(entry.name))
        .map((entry) => entry.name)
        .sort()
        .reverse();
    const retainedReleases = new Set([
        releaseId,
        ...releases.filter((release) => release !== releaseId).slice(0, 4),
    ]);

    try {
        for (const oldRelease of releases) {
            if (retainedReleases.has(oldRelease)) continue;
            await rm(join(siteDirectory, oldRelease), {
                recursive: true,
                force: true,
            });
        }
    } catch (error) {
        console.warn(`Релиз опубликован, но очистка не завершена: ${error.message}`);
    }

    console.log(`Опубликован релиз ${releaseId}: ${releaseDirectory}`);
} catch (error) {
    if (error.code === ALREADY_PUBLISHED) {
        console.log(error.message);
    } else {
        if (!published && releaseDirectory) {
            await rm(releaseDirectory, { recursive: true, force: true });
        }
        if (!published && publishedMarkerPath) {
            await rm(publishedMarkerPath, { force: true });
        }
        if (temporaryDirectory) {
            await rm(temporaryDirectory, { recursive: true, force: true });
        }
        console.error(`Не удалось опубликовать сайт: ${error.message}`);
        process.exitCode = 1;
    }
} finally {
    client?.release();
    await pool.end();
}
