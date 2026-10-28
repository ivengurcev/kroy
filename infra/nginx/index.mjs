import { execFile } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const outputDir = process.env.NGINX_CONFIG_DIR
    ? resolve(ROOT, process.env.NGINX_CONFIG_DIR)
    : join(ROOT, 'dist', 'kroy', 'nginx');
const configPath = join(outputDir, 'nginx.conf');
const execFileAsync = promisify(execFile);

async function request(action) {
    const baseUrl = process.env.KROY_NGINX_CONTROL_URL?.replace(/\/$/, '');
    const response = await fetch(`${baseUrl}/${action}`, {
        method: 'POST',
        signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Nginx control returned HTTP ${response.status}`);
}

async function direct(args) {
    await execFileAsync(process.env.NGINX_BIN || 'nginx', [...args, '-c', configPath], {
        cwd: ROOT,
    });
}

export async function validate() {
    if (process.env.KROY_NGINX_CONTROL_URL) await request('validate');
    else await direct(['-t']);
}

export async function reload() {
    if (process.env.KROY_NGINX_CONTROL_URL) await request('reload');
    else await direct(['-s', 'reload']);
}

export default { validate, reload };
