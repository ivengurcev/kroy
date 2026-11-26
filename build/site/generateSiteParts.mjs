import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverParts, discoverWidgets, validateDefaultWidgets } from '../registry/discoverParts.mjs';
import { isValidContent } from '../../shared/pageContent.mjs';
import { validateDocumentContent } from '../../shared/pageTemplates.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUTPUT_DIR = join(ROOT, 'dist', 'kroy');
const OUTPUT_PATH = join(OUTPUT_DIR, 'site-parts.mjs');

export default async function generateSiteParts(pages, siteSlug, { layouts = [], footer } = {}) {
    const documents = [...pages.map(({ content }) => content), ...layouts.flatMap(({ before, after }) => [before, after])];
    const allContent = [...documents.flat(), ...(footer ? [footer] : [])];
    const names = [...new Set(
        allContent.map(({ part }) => part)
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
    for (const content of documents) {
        if (validateDocumentContent(content, partCatalog, widgetCatalog, { allowMissingParts: true }).length) {
            throw new Error(`Некорректный content сайта ${siteSlug}: каждая запчасть требует совместимый виджет`);
        }
    }
    if (footer && !isValidContent([footer], partCatalog, widgetCatalog)) {
        throw new Error(`Глобальный футер сайта ${siteSlug} требует зарегистрированные запчасть и виджет`);
    }
    const widgetNames = [...new Set(
        allContent
            .filter(({ part }) => availableParts.has(part))
            .map(({ view }) => view.name)
    )];
    const imports = [];
    const partEntries = [];
    const widgetEntries = [];

    for (const [index, name] of names.entries()) {
        const part = availableParts.get(name);

        if (!part) {
            console.warn(`Запчасть сайта ${siteSlug} не найдена: ${name}; будет показана заглушка`);
            continue;
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
