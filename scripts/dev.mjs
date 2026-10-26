import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateParts } from './discoverParts.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
await generateParts();
const watcher = spawn(process.execPath, ['scripts/watchParts.mjs'], {
    cwd: ROOT,
    env: { ...process.env, KROY_WATCH_ONLY: '1', NODE_ENV: 'development' },
    stdio: 'inherit',
});
const vyaz = spawn(
    'yarn',
    ['node', '--env-file=.env', 'server.mjs', '--build-public', '--build-ssr', '--serve', '--watch', '--sourcemap'],
    { cwd: ROOT, stdio: 'inherit', env: { ...process.env, NODE_ENV: 'development' } }
);

let shuttingDown = false;
function stop() {
    if (shuttingDown) return;
    shuttingDown = true;
    watcher.kill('SIGTERM');
    vyaz.kill('SIGTERM');
}

process.once('SIGINT', stop);
process.once('SIGTERM', stop);
vyaz.once('exit', (code, signal) => {
    if (!shuttingDown) {
        stop();
        process.exitCode = signal ? 1 : (code ?? 1);
    }
});
