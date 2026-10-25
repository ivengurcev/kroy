import { execFile } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { pool } from '../db/client.mjs';
import generateNginxConfig from './generateNginxConfig.mjs';
import getActiveRelease from './getActiveRelease.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITES_DIR = join(ROOT, 'dist', 'sites');
const NGINX_DIR = process.env.NGINX_CONFIG_DIR ? resolve(ROOT, process.env.NGINX_CONFIG_DIR) : join(ROOT, 'dist', 'kroy', 'nginx');
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

async function reloadNginx() {
    await execFileAsync(process.env.NGINX_BIN || 'nginx', ['-s', 'reload'], { cwd: ROOT });
}

async function validateNginx() {
    const args = ['-t'];
    if (process.env.NGINX_CONFIG) args.push('-c', process.env.NGINX_CONFIG);
    await execFileAsync(process.env.NGINX_BIN || 'nginx', args, { cwd: ROOT });
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

        const fragmentPath = join(NGINX_DIR, `${siteSlug}.conf`);
        const previousFragment = await readOptional(fragmentPath);

        try {
            await generateNginxConfig(siteSlug, site.domains, {
                outputDir: NGINX_DIR,
                routingPath,
                siteRoot: `${siteSlug}/${releaseId}`,
                releaseId,
            });
            await validateNginx();
            await reloadNginx();
        } catch (error) {
            await restoreFile(fragmentPath, previousFragment);
            await validateNginx().catch(() => {});
            await reloadNginx().catch(() => {});
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
