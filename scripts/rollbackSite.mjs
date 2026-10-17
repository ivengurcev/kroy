import { execFile } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { pool } from '../db/client.mjs';
import generateCaddyConfig from './generateCaddyConfig.mjs';
import getActiveRelease from './getActiveRelease.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITES_DIR = join(ROOT, 'dist', 'sites');
const CADDY_DIR = join(ROOT, 'dist', 'kroy', 'caddy');
const execFileAsync = promisify(execFile);
const siteSlug = process.argv[2];
const releaseId = process.argv[3];

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

async function reloadCaddy() {
    await execFileAsync(
        'docker',
        [
            'compose',
            '--profile',
            'preview',
            'exec',
            'caddy',
            'caddy',
            'reload',
            '--config',
            '/etc/caddy/Caddyfile',
            '--adapter',
            'caddyfile',
        ],
        { cwd: ROOT }
    );
}

let client;

try {
    if (!siteSlug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(siteSlug)) {
        throw new Error('Укажите корректный slug сайта');
    }
    if (!releaseId || !/^\d{17}$/.test(releaseId)) {
        throw new Error('Укажите корректный release-id');
    }

    const releaseDirectory = join(SITES_DIR, siteSlug, releaseId);
    const routingPath = join(releaseDirectory, 'routing.json');
    await readFile(routingPath);

    if (await getActiveRelease(siteSlug) === releaseId) {
        console.log(`Релиз ${releaseId} уже активен`);
    } else {
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

        const configPath = join(CADDY_DIR, 'Caddyfile');
        const fragmentPath = join(CADDY_DIR, `${siteSlug}.Caddyfile`);
        const previousConfig = await readOptional(configPath);
        const previousFragment = await readOptional(fragmentPath);

        try {
            await generateCaddyConfig(siteSlug, site.domains, {
                routingPath,
                siteRoot: `${siteSlug}/${releaseId}`,
                releaseId,
            });
            await reloadCaddy();
        } catch (error) {
            await restoreFile(configPath, previousConfig);
            await restoreFile(fragmentPath, previousFragment);
            await reloadCaddy().catch(() => {});
            throw error;
        }

        console.log(`Активирован релиз ${releaseId} сайта ${siteSlug}`);
    }
} catch (error) {
    console.error(`Не удалось выполнить откат: ${error.message}`);
    process.exitCode = 1;
} finally {
    client?.release();
    await pool.end();
}
