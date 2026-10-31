import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverParts, discoverWidgets, validateDefaultWidgets } from './discoverParts.mjs';
import { createView } from '../editor/partModel.js';
import { isPlainObject, isValidContent } from '../api/pageContent.mjs';

export function migratePageContent(content, parts, widgets) {
    if (!Array.isArray(content)) throw new Error('Содержимое страницы должно быть массивом');
    const migrated = content.map((item) => {
        if (!isPlainObject(item)) throw new Error('Некорректный элемент страницы');
        if (Object.hasOwn(item, 'view')) return item;
        const part = parts[item.part];
        const widget = widgets[part?.defaultWidget];
        if (!widget) throw new Error(`Виджет по умолчанию не найден: ${item.part}`);
        return { ...item, view: createView(part.defaultWidget, widget.fields) };
    });
    if (!isValidContent(migrated, parts, widgets)) throw new Error('Некорректный content или несовместимый виджет');
    return migrated;
}

export async function migratePageViews(client, parts, widgets, { apply = false } = {}) {
    await client.query('BEGIN');
    try {
        const { rows } = await client.query(`SELECT id, content FROM pages ORDER BY id${apply ? ' FOR UPDATE' : ''}`);
        const changes = rows.map((page) => {
            try {
                return { ...page, nextContent: migratePageContent(page.content, parts, widgets) };
            } catch (error) {
                throw new Error(`Не удалось преобразовать страницу ${page.id}: ${error.message}`, { cause: error });
            }
        }).filter((page) => JSON.stringify(page.content) !== JSON.stringify(page.nextContent));
        if (apply) {
            for (const page of changes) {
                await client.query('UPDATE pages SET content = $1::jsonb WHERE id = $2', [JSON.stringify(page.nextContent), page.id]);
            }
        }
        await client.query('COMMIT');
        return { scanned: rows.length, changed: changes.length, applied: apply };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const args = process.argv.slice(2);
    if (args.length > 1 || args.length === 1 && args[0] !== '--apply') {
        throw new Error('Использование: yarn node --env-file-if-exists=.env scripts/migratePageViews.mjs [--apply]');
    }
    const [parts, widgets] = await Promise.all([discoverParts(), discoverWidgets()]);
    validateDefaultWidgets(parts, widgets);
    const partCatalog = Object.fromEntries(parts.map((part) => [part.name, part]));
    const widgetCatalog = Object.fromEntries(widgets.map((widget) => [widget.name, widget]));
    const { pool } = await import('../db/client.mjs');
    let client;
    try {
        client = await pool.connect();
        const result = await migratePageViews(client, partCatalog, widgetCatalog, { apply: args[0] === '--apply' });
        console.log(`${result.applied ? 'Миграция выполнена' : 'Предварительный просмотр, запись отключена'}: страниц ${result.scanned}, изменений ${result.changed}`);
    } finally {
        client?.release();
        await pool.end();
    }
}
