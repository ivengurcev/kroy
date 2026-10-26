import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const watcher = spawn(process.execPath, ['scripts/watchParts.mjs'], {
    cwd: ROOT,
    stdio: 'inherit',
});
const vyaz = spawn(
    'yarn',
    ['node', '--env-file=.env', 'server.mjs', '--build-public', '--build-ssr', '--serve', '--watch'],
    { cwd: ROOT, stdio: 'inherit' }
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
