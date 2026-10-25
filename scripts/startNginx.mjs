import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { ensureNginxConfig } from './generateNginxConfig.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = process.env.NGINX_CONFIG_DIR
    ? resolve(ROOT, process.env.NGINX_CONFIG_DIR)
    : join(ROOT, 'dist', 'kroy', 'nginx');
const configPath = await ensureNginxConfig({ outputDir });
const nginx = process.env.NGINX_BIN || 'nginx';
const execFileAsync = promisify(execFile);

await execFileAsync(nginx, ['-t', '-c', configPath], { cwd: ROOT });

let running = false;
try {
    const pid = Number.parseInt(await readFile(join(outputDir, 'nginx.pid'), 'utf8'), 10);
    process.kill(pid, 0);
    running = true;
} catch {
    running = false;
}

if (running) {
    await execFileAsync(nginx, ['-s', 'reload', '-c', configPath], { cwd: ROOT });
    console.log(`Nginx Kroy уже запущен; выполнен reload: ${configPath}`);
} else {
    await execFileAsync(nginx, ['-c', configPath], { cwd: ROOT });
    console.log(`Запущен Nginx Kroy: ${configPath}`);
}
