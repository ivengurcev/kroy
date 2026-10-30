import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverParts, discoverWidgets } from './discoverParts.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_DIR = join(ROOT, 'dist', 'kroy');
const OUTPUT_PATH = join(OUTPUT_DIR, 'site-parts.mjs');

export default async function generateSiteParts(pages, siteSlug) {
    const names = [...new Set(
        pages.flatMap(({ content }) => content.map(({ part }) => part))
    )];
    const widgetNames = [...new Set(
        pages.flatMap(({ content }) => content.map(({ view }) => view?.name).filter(Boolean))
    )];
    const [discoveredParts, discoveredWidgets] = await Promise.all([
        discoverParts(),
        discoverWidgets(),
    ]);
    const availableParts = new Map(discoveredParts.map((part) => [part.name, part]));
    const availableWidgets = new Map(discoveredWidgets.map((widget) => [widget.name, widget]));
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

    for (const page of pages) {
        for (const { part: partName, view } of page.content) {
            if (!view) continue;

            const part = availableParts.get(partName);
            const widget = availableWidgets.get(view.name);

            if (!widget) {
                throw new Error(`Виджет сайта ${siteSlug} не найден: ${view.name}`);
            }
            if (!part?.contract || part.contract !== widget.contract) {
                throw new Error(`Виджет ${view.name} несовместим с запчастью ${partName} сайта ${siteSlug}`);
            }
        }
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
