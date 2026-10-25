import { execFile } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = process.env.NGINX_CONFIG_DIR
    ? resolve(ROOT, process.env.NGINX_CONFIG_DIR)
    : join(ROOT, 'dist', 'kroy', 'nginx');
const configPath = join(outputDir, 'nginx.conf');
const action = process.argv[2];
if (!['validate', 'reload'].includes(action)) throw new Error('Использование: nginxControl.mjs validate|reload');

const nginx = process.env.NGINX_BIN || 'nginx';
const execFileAsync = promisify(execFile);
await execFileAsync(nginx, ['-t', '-c', configPath], { cwd: ROOT });
if (action === 'reload') await execFileAsync(nginx, ['-s', 'reload', '-c', configPath], { cwd: ROOT });
console.log(action === 'reload' ? `Nginx Kroy перезагружен: ${configPath}` : `Конфигурация Nginx Kroy корректна: ${configPath}`);
