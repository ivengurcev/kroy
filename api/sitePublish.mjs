import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../db/client.mjs';
import getHostname from './getHostname.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const YARN_PATH = join(ROOT, '.yarn', 'releases', 'yarn-4.18.1.cjs');
const ACTIVE_STATUSES = new Set(['building', 'publishing']);
const OUTPUT_LIMIT = 4096;
const publicationJobs = new Map();
let activePublication;

function appendOutput(output, chunk) {
    return `${output}${chunk}`.slice(-OUTPUT_LIMIT);
}

function lastLine(output, fallback) {
    const lines = output
        .trim()
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

    return lines.findLast((line) => line.startsWith('Не удалось')) ?? lines.at(-1) ?? fallback;
}

function snapshot(job) {
    if (!job) return { status: 'idle' };

    return {
        status: job.status,
        ...(job.message ? { message: job.message } : {}),
        ...(job.releaseId ? { releaseId: job.releaseId } : {}),
        ...(job.finishedAt ? { finishedAt: job.finishedAt } : {}),
    };
}

async function getCurrentSite(c) {
    const hostname = getHostname(c);
    if (!hostname) return null;

    const { rows: [site] } = await pool.query(
        `SELECT s.id, s.slug
         FROM sites s
         JOIN domains d ON d.site_id = s.id
         WHERE d.hostname = $1`,
        [hostname],
    );

    return site ?? null;
}

function runPackageScript(script, slug, onOutput) {
    return new Promise((resolvePromise, reject) => {
        const child = spawn(
            process.execPath,
            [YARN_PATH, 'run', script, slug],
            { cwd: ROOT },
        );
        let output = '';

        child.stdout.on('data', (chunk) => {
            output = appendOutput(output, chunk);
            onOutput?.(output);
        });
        child.stderr.on('data', (chunk) => {
            output = appendOutput(output, chunk);
            onOutput?.(output);
        });
        child.on('error', reject);
        child.on('close', (code) => {
            if (code === 0) {
                resolvePromise(output);
                return;
            }
            reject(new Error(lastLine(output, `Команда ${script} завершилась с ошибкой.`)));
        });
    });
}

async function runPublication(site, job) {
    try {
        const output = await runPackageScript('site:publish', site.slug, (currentOutput) => {
            if (!currentOutput.includes('Сборка завершена.')) return;
            job.status = 'publishing';
            job.message = 'Публикация сайта…';
        });
        job.status = 'success';
        job.message = 'Сайт опубликован.';
        job.releaseId = output.match(/Опубликован релиз (\d{17})/)?.[1];
    } catch (error) {
        job.status = 'error';
        job.message = error.message || 'Не удалось опубликовать сайт.';
    }

    job.finishedAt = new Date().toISOString();
    if (activePublication?.job === job) activePublication = undefined;
}

export async function getSitePublishStatus(c) {
    try {
        const site = await getCurrentSite(c);
        if (!site) return c.json({ error: 'Site not found' }, 404);
        return c.json(snapshot(publicationJobs.get(site.id)));
    } catch (error) {
        console.error('Failed to get site publication status', error);
        return c.json({ error: 'Internal server error' }, 500);
    }
}

export async function startSitePublish(c) {
    try {
        const site = await getCurrentSite(c);
        if (!site) return c.json({ error: 'Site not found' }, 404);

        const current = publicationJobs.get(site.id);
        if (current && ACTIVE_STATUSES.has(current.status)) {
            return c.json(snapshot(current), 202);
        }
        if (activePublication) {
            return c.json({ error: 'Уже выполняется публикация другого сайта. Попробуйте позже.' }, 409);
        }

        const job = { status: 'building', message: 'Сборка сайта…' };
        publicationJobs.set(site.id, job);
        activePublication = { siteId: site.id, job };
        void runPublication(site, job);

        return c.json(snapshot(job), 202);
    } catch (error) {
        console.error('Failed to start site publication', error);
        return c.json({ error: 'Internal server error' }, 500);
    }
}
