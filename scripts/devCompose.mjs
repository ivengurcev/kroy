import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const [action, service, ...extra] = process.argv.slice(2);
const services = new Set(['app', 'nginx', 'db']);
const commands = {
    up: ['up'],
    background: ['up', '-d'],
    down: ['down'],
    logs: ['logs', '--follow'],
    status: ['ps'],
    restart: service && services.has(service) && extra.length === 0
        ? ['restart', service]
        : null,
    rebuild: service && services.has(service) && extra.length === 0
        ? ['up', '-d', '--build', '--no-deps', '--force-recreate', service]
        : null,
};

const args = commands[action];
if (!args) {
    console.error(action === 'restart' || action === 'rebuild'
        ? `Использование: yarn dev:${action} app|nginx|db`
        : 'Неизвестная команда Compose');
    process.exit(1);
}

for (const directory of ['dist/sites', 'dist/kroy/nginx-dev', 'data/media']) {
    mkdirSync(directory, { recursive: true });
}

const child = spawn(
    'docker',
    ['compose', '-f', 'infra/compose.yaml', ...args],
    {
        stdio: 'inherit',
        env: {
            ...process.env,
            KROY_UID: String(process.getuid?.() ?? 1000),
            KROY_GID: String(process.getgid?.() ?? 1000),
        },
    },
);

let stopping = false;
function stop(signal) {
    if (stopping) return;
    stopping = true;
    // Ctrl+C already reaches Compose through the shared terminal process group.
    // Forward other signals sent directly to this supervisor.
    if (signal !== 'SIGINT') child.kill(signal);
}

process.once('SIGINT', () => stop('SIGINT'));
process.once('SIGTERM', () => stop('SIGTERM'));
child.once('error', (error) => {
    console.error(`Не удалось запустить Docker Compose: ${error.message}`);
    process.exitCode = 1;
});
child.once('exit', (code, signal) => {
    if (signal && !stopping) process.kill(process.pid, signal);
    else process.exitCode = code ?? (signal === 'SIGINT' ? 130 : signal === 'SIGTERM' ? 143 : 0);
});
