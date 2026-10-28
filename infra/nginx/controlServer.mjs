import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const config = process.env.NGINX_CONFIG || '/app/dist/kroy/nginx/nginx.conf';
const port = Number.parseInt(process.env.NGINX_CONTROL_PORT || '3001', 10);

async function validate() {
    await execFileAsync('nginx', ['-t', '-c', config]);
}

async function reload() {
    await validate();
    await execFileAsync('nginx', ['-s', 'reload', '-c', config]);
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
