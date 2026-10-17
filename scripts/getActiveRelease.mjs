import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CADDY_DIR = join(ROOT, 'dist', 'kroy', 'caddy');

export default async function getActiveRelease(siteSlug) {
    try {
        const fragment = await readFile(
            join(CADDY_DIR, `${siteSlug}.Caddyfile`),
            'utf8'
        );
        const metadata = fragment.match(/^# Kroy release: (\d{17})$/m);

        if (metadata) return metadata[1];

        return fragment.match(
            new RegExp(`root \\* "/srv/${siteSlug}/(\\d{17})"`)
        )?.[1];
    } catch (error) {
        if (error.code === 'ENOENT') return undefined;
        throw error;
    }
}
