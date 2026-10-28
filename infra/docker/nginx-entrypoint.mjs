import { spawn } from 'node:child_process';

const config = process.env.NGINX_CONFIG || '/app/dist/kroy/nginx/nginx.conf';
const children = [
    spawn('nginx', ['-c', config, '-g', 'daemon off;'], { stdio: 'inherit' }),
    spawn(process.execPath, ['/opt/kroy/controlServer.mjs'], { stdio: 'inherit' }),
];

let stopping = false;

function stop(signal = 'SIGTERM') {
    if (stopping) return;
    stopping = true;
    for (const child of children) child.kill(signal);
}

process.once('SIGINT', () => stop('SIGINT'));
process.once('SIGTERM', () => stop('SIGTERM'));

for (const child of children) {
    child.once('error', (error) => {
        console.error(error.message);
        process.exitCode = 1;
        stop();
    });
    child.once('exit', (code, signal) => {
        if (!stopping) {
            process.exitCode = signal ? 1 : (code ?? 1);
            stop();
        }
    });
}
