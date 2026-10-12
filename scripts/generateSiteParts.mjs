import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverParts } from './discoverParts.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE_PATH = join(ROOT, 'demo', 'page.json');
const OUTPUT_DIR = join(ROOT, 'generated');
const OUTPUT_PATH = join(OUTPUT_DIR, 'site-parts.mjs');

const content = JSON.parse(await readFile(PAGE_PATH, 'utf8'));
const names = [...new Set(content.map(({ part }) => part))];
const availableParts = new Map(
    (await discoverParts()).map((part) => [part.name, part])
);
const imports = [];
const entries = [];

for (const [index, name] of names.entries()) {
    const part = availableParts.get(name);

    if (!part) {
        throw new Error(`Запчасть из demo/page.json не найдена: ${name}`);
    }

    const variable = `Part${index}`;
    let importPath = relative(OUTPUT_DIR, part.componentPath)
        .split(sep)
        .join('/');

    if (!importPath.startsWith('.')) {
        importPath = `./${importPath}`;
    }

    imports.push(`import ${variable} from ${JSON.stringify(importPath)};`);
    entries.push(`    ${JSON.stringify(name)}: ${variable},`);
}

const moduleSource = [
    '// Generated automatically. Do not edit.',
    ...imports,
    '',
    'export const parts = {',
    ...entries,
    '};',
    '',
].join('\n');

await mkdir(OUTPUT_DIR, { recursive: true });
await writeFile(OUTPUT_PATH, moduleSource);

console.log(`Создан реестр запчастей сайта: ${OUTPUT_PATH}`);
