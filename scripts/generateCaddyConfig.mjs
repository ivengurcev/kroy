import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ROUTING_DIR = join(ROOT, 'dist', 'kroy', 'routing');
const OUTPUT_DIR = join(ROOT, 'dist', 'kroy', 'caddy');

function quote(value) {
    return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}

export default async function generateCaddyConfig(siteSlug) {
    const routing = JSON.parse(
        await readFile(join(ROUTING_DIR, `${siteSlug}.json`), 'utf8')
    );
    const rules = [];

    for (const [index, redirect] of routing.redirects.entries()) {
        rules.push(`\t\t@redirect${index} path ${quote(redirect.from)}`);
        rules.push(`\t\tredir @redirect${index} ${quote(redirect.to)} 301`);
    }

    if (routing.gone.length > 0) {
        rules.push(`\t\t@gone path ${routing.gone.map(quote).join(' ')}`);
        rules.push('\t\trespond @gone 410');
    }

    const config = [
        `http://${siteSlug}.localhost:8080 {`,
        '\troute {',
        ...rules,
        '\t\troot * /srv',
        '\t\ttry_files {path}/index.html {path}',
        '\t\tfile_server',
        '\t}',
        '}',
        '',
    ].join('\n');
    const outputPath = join(OUTPUT_DIR, `${siteSlug}.Caddyfile`);

    await mkdir(OUTPUT_DIR, { recursive: true });
    await writeFile(outputPath, config);

    console.log(`Создана конфигурация Caddy: ${outputPath}`);
}
