import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverParts, discoverWidgets, validateDefaultWidgets } from './discoverParts.mjs';
import { isValidContent } from '../api/pageContent.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_DIR = join(ROOT, 'dist', 'kroy');
const OUTPUT_PATH = join(OUTPUT_DIR, 'site-parts.mjs');

export default async function generateSiteParts(pages, siteSlug) {
    const names = [...new Set(
        pages.flatMap(({ content }) => content.map(({ part }) => part))
    )];
    const widgetNames = [...new Set(
        pages.flatMap(({ content }) => content.map(({ view }) => view?.name))
    )];
    const [discoveredParts, discoveredWidgets] = await Promise.all([
        discoverParts(),
        discoverWidgets(),
    ]);
    const availableParts = new Map(discoveredParts.map((part) => [part.name, part]));
    const availableWidgets = new Map(discoveredWidgets.map((widget) => [widget.name, widget]));
    validateDefaultWidgets(discoveredParts, discoveredWidgets);
    const partCatalog = Object.fromEntries(availableParts);
    const widgetCatalog = Object.fromEntries(availableWidgets);
    for (const page of pages) {
        if (!isValidContent(page.content, partCatalog, widgetCatalog)) {
            throw new Error(`Некорректный content сайта ${siteSlug}: каждая запчасть требует совместимый виджет`);
        }
    }
    const imports = [];
    const partEntries = [];
    const widgetEntries = [];

    for (const [index, name] of names.entries()) {
        const part = availableParts.get(name);

        if (!part) {
            throw new Error(`Запчасть сайта ${siteSlug} не найдена: ${name}`);
        }

        const variable = `Part${index}`;
        let importPath = relative(OUTPUT_DIR, part.componentPath)
            .split(sep)
            .join('/');

        if (!importPath.startsWith('.')) {
            importPath = `./${importPath}`;
        }

        imports.push(`import ${variable} from ${JSON.stringify(importPath)};`);
        partEntries.push(`    ${JSON.stringify(name)}: ${variable},`);
    }

    for (const [index, name] of widgetNames.entries()) {
        const widget = availableWidgets.get(name);
        const variable = `Widget${index}`;
        let importPath = relative(OUTPUT_DIR, widget.componentPath)
            .split(sep)
            .join('/');

        if (!importPath.startsWith('.')) {
            importPath = `./${importPath}`;
        }

        imports.push(`import ${variable} from ${JSON.stringify(importPath)};`);
        widgetEntries.push(`    ${JSON.stringify(name)}: ${variable},`);
    }

    const moduleSource = [
        '// Generated automatically. Do not edit.',
        ...imports,
        '',
        'export const parts = {',
        ...partEntries,
        '};',
        '',
        'export const widgets = {',
        ...widgetEntries,
        '};',
        '',
    ].join('\n');

    await mkdir(OUTPUT_DIR, { recursive: true });
    await writeFile(OUTPUT_PATH, moduleSource);

    console.log(`Создан реестр запчастей сайта: ${OUTPUT_PATH}`);
}
