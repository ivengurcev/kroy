import { spawn } from 'node:child_process';
import { createServer } from 'node:http';

const config = process.env.NGINX_CONFIG || '/app/dist/kroy/nginx/nginx.conf';
const port = Number.parseInt(process.env.NGINX_CONTROL_PORT || '3001', 10);

function runNginx(args) {
    return new Promise((resolve, reject) => {
        const child = spawn('nginx', args, { stdio: 'inherit' });
        child.once('error', reject);
        child.once('close', (code, signal) => {
            if (code === 0) {
                resolve();
                return;
            }

            const error = new Error(signal
                ? `nginx остановлен сигналом ${signal}`
                : `nginx завершился с кодом ${code ?? 1}`);
            error.code = code ?? 1;
            error.signal = signal;
            reject(error);
        });
    });
}

async function validate() {
    await runNginx(['-t', '-c', config]);
}

async function reload() {
    await validate();
    await runNginx(['-s', 'reload', '-c', config]);
}

const actions = new Map([
    ['/validate', validate],
    ['/reload', reload],
]);

const server = createServer(async (request, response) => {
    const action = request.method === 'POST' && actions.get(request.url);
    if (!action) {
        response.writeHead(404).end();
        return;
    }

    try {
        await action();
        response.writeHead(204).end();
    } catch (error) {
        console.error(`Nginx control failed: ${error.message}`);
        response.writeHead(500).end();
    }
});

server.listen(port, '0.0.0.0');

function stop() {
    server.close(() => process.exit());
}

process.once('SIGINT', stop);
process.once('SIGTERM', stop);
