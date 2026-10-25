import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const NGINX_DIR = process.env.NGINX_CONFIG_DIR ? resolve(ROOT, process.env.NGINX_CONFIG_DIR) : join(ROOT, 'dist', 'kroy', 'nginx');

export default async function getActiveRelease(siteSlug, nginxDir = NGINX_DIR) {
    try {
        const fragment = await readFile(
            join(nginxDir, `${siteSlug}.conf`),
            'utf8'
        );
        const metadata = fragment.match(/^# Kroy release: (\d{17})$/m);

        if (metadata) return metadata[1];

        return fragment.match(new RegExp(`root .*${siteSlug}/(\\d{17})[";]`))?.[1];
    } catch (error) {
        if (error.code === 'ENOENT') return undefined;
        throw error;
    }
}
