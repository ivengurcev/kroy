import { join, resolve } from 'node:path';
import nginx from '../infra/nginx/index.mjs';

const outputDir = process.env.NGINX_CONFIG_DIR
    ? resolve(process.cwd(), process.env.NGINX_CONFIG_DIR)
    : resolve('dist', 'kroy', 'nginx');
const configPath = join(outputDir, 'nginx.conf');
const action = process.argv[2];
if (!['validate', 'reload'].includes(action)) throw new Error('Использование: nginxControl.mjs validate|reload');

await nginx.validate();
if (action === 'reload') await nginx.reload();
console.log(action === 'reload' ? `Nginx Kroy перезагружен: ${configPath}` : `Конфигурация Nginx Kroy корректна: ${configPath}`);
