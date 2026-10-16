import { execFile } from 'node:child_process';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { isValidPagePath } from '../api/pageFields.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ROUTING_DIR = join(ROOT, 'dist', 'kroy', 'routing');
const OUTPUT_DIR = join(ROOT, 'dist', 'kroy', 'caddy');
const execFileAsync = promisify(execFile);

function quote(value) {
    return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}

export default async function generateCaddyConfig(siteSlug) {
    const routing = JSON.parse(
        await readFile(join(ROUTING_DIR, `${siteSlug}.json`), 'utf8')
    );
    const redirectsAreValid = Array.isArray(routing.redirects)
        && routing.redirects.every((redirect) => (
            redirect?.status === 301
            && isValidPagePath(redirect.from)
            && isValidPagePath(redirect.to)
        ));
    const goneIsValid = Array.isArray(routing.gone)
        && routing.gone.every(isValidPagePath);

    if (!redirectsAreValid || !goneIsValid) {
        throw new Error(`Некорректные правила маршрутизации сайта ${siteSlug}`);
    }

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
        '\t\t@vyaz path /admin /admin/* /api /api/* /public /public/* /static /static/* /uploads /uploads/*',
        '\t\treverse_proxy @vyaz host.docker.internal:3000 {',
        '\t\t\theader_up Host {hostport}',
        '\t\t}',
        ...rules,
        '\t\troot * /srv',
        '\t\ttry_files {path}/index.html {path}',
        '\t\tfile_server',
        '\t}',
        '}',
        '',
    ].join('\n');
    const outputPath = join(OUTPUT_DIR, `${siteSlug}.Caddyfile`);
    const temporaryPath = `${outputPath}.tmp`;

    await mkdir(OUTPUT_DIR, { recursive: true });

    try {
        await writeFile(temporaryPath, config);
        await execFileAsync(
            'docker',
            [
                'compose',
                '--profile',
                'preview',
                'run',
                '--rm',
                '--no-deps',
                'caddy',
                'caddy',
                'validate',
                '--config',
                `/etc/caddy/${siteSlug}.Caddyfile.tmp`,
                '--adapter',
                'caddyfile',
            ],
            { cwd: ROOT }
        );
        await rename(temporaryPath, outputPath);
    } finally {
        await rm(temporaryPath, { force: true });
    }

    console.log(`Создана конфигурация Caddy: ${outputPath}`);
}
