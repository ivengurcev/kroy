import { spawn } from 'node:child_process';

const RUNNER = '/usr/local/sbin/kroy-run';

export function getRemoteHost() {
    const host = process.env.KROY_REMOTE_HOST?.trim();
    if (!host) {
        console.error('Задайте KROY_REMOTE_HOST в окружении.');
        process.exit(1);
    }
    if (!/^[A-Za-z0-9._@:\[\]-]+$/.test(host) || host.startsWith('-')) {
        console.error('KROY_REMOTE_HOST содержит недопустимые символы.');
        process.exit(1);
    }
    return host;
}

function quote(value) {
    return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

export function buildRemoteCommand(argv) {
    return argv.map(quote).join(' ');
}

export function run(command, args, options = {}) {
    return new Promise((resolve) => {
        const child = spawn(command, args, { stdio: 'inherit', ...options });
        child.on('error', (error) => {
            console.error(`Не удалось запустить ${command}: ${error.message}`);
            resolve(1);
        });
        child.on('exit', (code, signal) => {
            if (signal) {
                process.kill(process.pid, signal);
                resolve(1);
                return;
            }
            resolve(code ?? 1);
        });
    });
}

export function runRemoteScript(host, script, args = [], { tty = false } = {}) {
    const sshArgs = [];
    if (tty && process.stdin.isTTY) sshArgs.push('-t');
    sshArgs.push(
        host,
        buildRemoteCommand(['sudo', '-n', '-u', 'kroy', RUNNER, script, ...args]),
    );
    return run('ssh', sshArgs);
}
