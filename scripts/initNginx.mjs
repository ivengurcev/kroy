import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureNginxConfig } from './generateNginxConfig.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = process.env.NGINX_CONFIG_DIR
    ? resolve(root, process.env.NGINX_CONFIG_DIR)
    : join(root, 'dist', 'kroy', 'nginx');

console.log(`Подготовлен базовый конфиг Nginx Kroy: ${await ensureNginxConfig({ outputDir })}`);
