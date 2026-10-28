import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../db/client.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LOCK_NAME = 'kroy:site-publication';
const siteSlug = process.argv[2];
let activeChild;
let terminationSignal;

function runScript(script) {
    if (terminationSignal) {
        return Promise.reject(new Error(`${script} не запущен: получен ${terminationSignal}`));
    }

    return new Promise((resolvePromise, reject) => {
        const child = spawn(
            process.execPath,
            ['--env-file-if-exists=.env', script, siteSlug],
            { cwd: ROOT, stdio: 'inherit' },
        );
        activeChild = child;
        child.once('error', reject);
        child.once('exit', (code, signal) => {
            activeChild = undefined;
            if (code === 0) resolvePromise();
            else reject(Object.assign(new Error(signal
                ? `${script} остановлен сигналом ${signal}`
                : `${script} завершился с кодом ${code ?? 1}`), { childFailed: true }));
        });
    });
}

function stop(signal) {
    terminationSignal ??= signal;
    activeChild?.kill(signal);
}

process.once('SIGINT', () => stop('SIGINT'));
process.once('SIGTERM', () => stop('SIGTERM'));

let client;
let locked = false;

try {
    if (!siteSlug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(siteSlug)) {
        throw new Error('Укажите корректный slug сайта: yarn site:publish <slug>');
    }

    client = await pool.connect();
    const { rows: [{ acquired }] } = await client.query(
        'SELECT pg_try_advisory_lock(hashtext($1)) AS acquired',
        [LOCK_NAME],
    );
    if (!acquired) throw new Error('Уже выполняется другая публикация. Попробуйте позже.');
    locked = true;

    await runScript('scripts/buildSite.mjs');
    console.log('Сборка завершена. Публикация сайта…');
    await runScript('scripts/publishPreparedSite.mjs');
} catch (error) {
    if (!terminationSignal && !error.childFailed) {
        console.error(`Не удалось опубликовать сайт: ${error.message}`);
    }
    process.exitCode = terminationSignal === 'SIGINT' ? 130 : terminationSignal ? 143 : 1;
} finally {
    if (locked) {
        await client.query('SELECT pg_advisory_unlock(hashtext($1))', [LOCK_NAME]).catch(() => {});
    }
    client?.release();
    await pool.end();
}
