import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { watch } from 'node:fs';
import { generateParts } from '../build/registry/discoverParts.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
await generateParts();
const watcher = spawn(process.execPath, ['scripts/watchParts.mjs'], {
    cwd: ROOT,
    env: { ...process.env, KROY_WATCH_ONLY: '1', NODE_ENV: 'development' },
    stdio: 'inherit',
});
let shuttingDown = false;
let restarting = false;
let restartTimer;
let vyaz;

function startServer() {
    vyaz = spawn(
        process.execPath,
        ['server.mjs', '--build-public', '--build-ssr', '--serve', '--watch', '--sourcemap'],
        { cwd: ROOT, stdio: 'inherit', env: { ...process.env, NODE_ENV: 'development' } }
    );
    vyaz.once('exit', (code, signal) => {
        if (shuttingDown) return;
        if (restarting) {
            restarting = false;
            startServer();
        } else {
            stop();
            process.exitCode = signal ? 1 : (code ?? 1);
        }
    });
}

// Vyaz's --watch rebuilds UI/SSR, but API handlers are imported once by server.mjs.
// Watch only server sources: watching generated dist/ imports would restart forever.
const serverWatchers = ['.', 'server', 'shared', 'db'].map((path) =>
    watch(resolve(ROOT, path), { recursive: path !== '.' }, (_, filename) => {
        if (path === '.' && filename !== 'server.mjs') return;
        if (filename && (!/\.(?:mjs|js|json)$/.test(filename) || /\.test\./.test(filename))) return;
        clearTimeout(restartTimer);
        restartTimer = setTimeout(() => {
            if (shuttingDown || restarting) return;
            console.log('Серверные исходники изменились — перезапуск API и сборки интерфейса');
            restarting = true;
            vyaz.kill('SIGTERM');
        }, 150);
    })
);
startServer();

function stop() {
    if (shuttingDown) return;
    shuttingDown = true;
    clearTimeout(restartTimer);
    serverWatchers.forEach((watcher) => watcher.close());
    watcher.kill('SIGTERM');
    vyaz.kill('SIGTERM');
}

process.once('SIGINT', stop);
process.once('SIGTERM', stop);
