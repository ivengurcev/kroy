
import { readdir, readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePartDoc } from './parsePartDoc.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PARTS_DIR = join(ROOT, 'parts');
const WIDGETS_DIR = join(ROOT, 'widgets');
const OUTPUT_DIR = join(ROOT, 'dist', 'kroy');

const asPosix = (path) => path.split(sep).join('/');
const toKebabCase = (value) => value
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase();
const componentName = (root, path) => `@kroy/${asPosix(relative(root, path))
    .split('/')
    .map(toKebabCase)
    .join('/')}`;
const COMPONENT_NAME_PATTERN = /^@kroy\/[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/;

function fallbackTitle(name) {
    const value = name.split('/').at(-1).replaceAll('-', ' ');
    return `${value[0].toLocaleUpperCase()}${value.slice(1)}`;
}

async function readManifest(directory) {
    const path = join(directory, 'package.json');
    let source;

    try {
        source = await readFile(path, 'utf8');
    } catch (error) {
        if (error.code === 'ENOENT') return null;
        throw error;
    }

    try {
        const manifest = JSON.parse(source);
        if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
            throw new Error('Ожидался объект');
        }
        return manifest;
    } catch (error) {
        throw new Error(`Некорректный package.json: ${path}`, { cause: error });
    }
}

async function discoverComponents(root, { optional = false } = {}) {
    const components = [];
    const names = new Map();

    async function register(name, componentPath) {
        if (typeof name !== 'string' || !COMPONENT_NAME_PATTERN.test(name)) {
            throw new Error(
                `Некорректное имя компонента ${JSON.stringify(name)}: ожидается @kroy/<kebab-case>`
            );
        }
        if (names.has(name)) {
            throw new Error(`Дублируется имя ${name}: ${names.get(name)} и ${componentPath}`);
        }

        const info = await stat(componentPath);
        if (!info.isFile()) {
            throw new Error(`Точка входа не является файлом: ${componentPath}`);
        }

        const metadata = parsePartDoc(await readFile(componentPath, 'utf8'));
        names.set(name, componentPath);
        components.push({
            name,
            componentPath,
            title: metadata.title ?? fallbackTitle(name),
            category: metadata.category ?? 'Другое',
            contract: metadata.contract,
            fields: metadata.fields,
        });
    }

    async function scan(directory) {
        const entries = await readdir(directory, { withFileTypes: true });

        for (const entry of entries) {
            const path = join(directory, entry.name);

            if (entry.isDirectory()) {
                const manifest = await readManifest(path);

                if (manifest) {
                    if (typeof manifest.main !== 'string' || !manifest.main.trim()) {
                        throw new Error(`В ${path}/package.json не указан main`);
                    }

                    const componentPath = resolve(path, manifest.main);
                    const local = relative(path, componentPath);

                    if (
                        local === '..'
                        || local.startsWith(`..${sep}`)
                        || isAbsolute(local)
                    ) {
                        throw new Error(`main выходит за пределы компонента: ${path}`);
                    }

                    await register(manifest.name ?? componentName(root, path), componentPath);
                } else {
                    await scan(path);
                }
            } else if (entry.isFile() && extname(entry.name) === '.jsx') {
                await register(componentName(root, path.slice(0, -'.jsx'.length)), path);
            }
        }
    }

    try {
        await scan(root);
    } catch (error) {
        if (!optional || error.code !== 'ENOENT' || error.path !== root) throw error;
    }

    return components.sort((a, b) => a.name.localeCompare(b.name));
}

export function discoverParts() {
    return discoverComponents(PARTS_DIR);
}

export function discoverWidgets() {
    return discoverComponents(WIDGETS_DIR, { optional: true });
}

function registryFiles(components, exportName) {
    const imports = [];
    const entries = [];
    const metadata = {};

    for (const [index, component] of components.entries()) {
        const variable = `${exportName === 'parts' ? 'Part' : 'Widget'}${index}`;
        let importPath = asPosix(relative(OUTPUT_DIR, component.componentPath));

        if (!importPath.startsWith('.')) {
            importPath = `./${importPath}`;
        }

        imports.push(`import ${variable} from ${JSON.stringify(importPath)};`);
        entries.push(`    ${JSON.stringify(component.name)}: ${variable},`);
        metadata[component.name] = {
            title: component.title,
            category: component.category,
            contract: component.contract,
            fields: component.fields,
        };
    }

    return {
        moduleSource: [
            '// Generated automatically. Do not edit.',
            ...imports,
            '',
            `export const ${exportName} = {`,
            ...entries,
            '};',
            '',
        ].join('\n'),
        metadata,
    };
}

export async function generateParts() {
    const [parts, widgets] = await Promise.all([
        discoverParts(),
        discoverWidgets(),
    ]);
    const partFiles = registryFiles(parts, 'parts');
    const widgetFiles = registryFiles(widgets, 'widgets');

    await mkdir(OUTPUT_DIR, { recursive: true });
    await Promise.all([
        writeFile(join(OUTPUT_DIR, 'parts.mjs'), partFiles.moduleSource),
        writeFile(join(OUTPUT_DIR, 'parts.json'), JSON.stringify(partFiles.metadata, null, 2) + '\n'),
        writeFile(join(OUTPUT_DIR, 'widgets.mjs'), widgetFiles.moduleSource),
        writeFile(join(OUTPUT_DIR, 'widgets.json'), JSON.stringify(widgetFiles.metadata, null, 2) + '\n'),
    ]);

    return parts;
}

if (
    process.argv[1]
    && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
    const parts = await generateParts();

    console.log(`Найдено запчастей: ${parts.length}`);

    for (const part of parts) {
        console.log(`  ${part.name}`);
    }
}
