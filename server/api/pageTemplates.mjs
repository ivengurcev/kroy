import partCatalog from '../../dist/kroy/parts.json' with { type: 'json' };
import widgetCatalog from '../../dist/kroy/widgets.json' with { type: 'json' };
import { pool } from '../../db/client.mjs';
import { listPageTemplates, templateColumns } from '../../db/pageTemplates.mjs';
import { isPlainObject } from '../../shared/pageContent.mjs';
import { resolvePageTemplate, validateDocumentContent, validateTemplateContent } from '../../shared/pageTemplates.mjs';
import { isLegalPagePath } from '../../shared/legalDocuments.mjs';
import { repairDocumentBlocks } from '../../shared/lexicalEditor.mjs';
import { availableFooterPages, footerPageIds, isSiteFooterUrl, legacyFooterDocuments, normalizeFooterSettings } from '../../shared/footerSettings.mjs';
import getHostname from './getHostname.mjs';
import getCurrentSite from './siteContext.mjs';
import isUuid from './isUuid.mjs';

function reject(status, error, extra) {
    throw Object.assign(new Error(error), { status, response: { error, ...extra } });
}

function fields(value, allowed) {
    return isPlainObject(value) && Object.keys(value).every((key) => allowed.includes(key));
}

async function readBody(c) {
    return c.req.json().catch(() => null);
}

function nameOf(value) {
    const name = typeof value === 'string' ? value.trim() : '';
    if (!name || [...name].length > 100) reject(400, 'Проверьте имя шаблона', { fields: { name: 'Введите от 1 до 100 символов' } });
    return name;
}

function checkVersion(expected, current, code) {
    if (!Number.isInteger(expected) || expected < 1) reject(400, 'Укажите версию сохранённых данных');
    if (expected !== current) reject(409, 'Данные изменены в другом редакторе', { code, version: current });
}

async function write(c, operation) {
    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');
        const { rows: [site] } = await client.query(
            `SELECT s.id, s.default_template_id, s.footer_settings, s.footer_version
             FROM sites s JOIN domains d ON d.site_id = s.id WHERE d.hostname = $1 FOR UPDATE OF s`,
            [getHostname(c)],
        );
        if (!site) reject(404, 'Сайт не найден');
        const { value, status = 200 } = await operation(client, site);
        await client.query('COMMIT');
        return status === 204 ? c.body(null, 204) : c.json(value, status);
    } catch (error) {
        await client?.query('ROLLBACK').catch(() => {});
        if (error.response) return c.json(error.response, error.status);
        if (error.constraint === 'page_templates_site_name_key') {
            return c.json({ error: 'Имя шаблона занято', fields: { name: 'Выберите другое имя' } }, 409);
        }
        console.error('Failed to save page layout', error);
        return c.json({ error: 'Не удалось сохранить изменения' }, 500);
    } finally {
        client?.release();
    }
}

async function lockedTemplate(client, siteId, id) {
    if (!isUuid(id)) reject(400, 'Некорректный идентификатор шаблона');
    const { rows: [template] } = await client.query(
        `SELECT ${templateColumns} FROM page_templates WHERE site_id = $1 AND id = $2 FOR UPDATE`, [siteId, id],
    );
    if (!template) reject(404, 'Шаблон не найден');
    return template;
}

async function checkLinks(client, siteId, ids, existingIds) {
    const newIds = [...new Set(ids)].filter((id) => !existingIds.includes(id));
    if (!newIds.length) return;
    const { rows } = await client.query(
        `SELECT id, site_id, path, page_type AS type FROM pages
         WHERE site_id = $1 AND id = ANY($2::uuid[]) AND deleted_at IS NULL`,
        [siteId, newIds],
    );
    if (availableFooterPages(rows, siteId).length !== newIds.length) reject(400, 'Выберите доступные страницы текущего сайта');
}

async function validateBlockReferences(client, siteId, content, previous, page = {}) {
    const sections = new Set();
    const newLinks = [];
    const oldLinks = previous.filter(({ part }) => part === '@kroy/header')
        .flatMap(({ props }) => Array.isArray(props.navigation) ? props.navigation.map((link) => link?.pageId) : []);
    for (const { part, props } of content) {
        if (part === '@kroy/material-list') {
            if (!props.sectionId && page.page_type === 'list' && page.data_source === 'materials') continue;
            if (!isUuid(props.sectionId)) reject(400, 'Выберите раздел материалов');
            sections.add(props.sectionId.toLowerCase());
        }
        if (part === '@kroy/header') {
            const { title = '', navigation = [] } = props;
            if (typeof title !== 'string' || title.length > 200 || !Array.isArray(navigation) || navigation.length > 50
                || navigation.some((link) => !fields(link, ['pageId']) || !isUuid(link.pageId))) {
                reject(400, 'Проверьте название и ссылки шапки');
            }
            newLinks.push(...navigation.map(({ pageId }) => pageId.toLowerCase()));
        }
    }
    await checkLinks(client, siteId, newLinks, oldLinks);
    if (sections.size) {
        const { rowCount } = await client.query(
            'SELECT id FROM material_sections WHERE site_id = $1 AND id = ANY($2::uuid[]) FOR KEY SHARE', [siteId, [...sections]],
        );
        if (rowCount !== sections.size) reject(400, 'Раздел материалов отсутствует или недоступен на этом сайте');
    }
}

async function saveFooter(client, site, change) {
    if (!fields(change, ['props', 'expectedVersion'])) reject(400, 'Некорректные настройки футера');
    checkVersion(change.expectedVersion, site.footer_version, 'footer_conflict');
    const { settings, fields: errors } = normalizeFooterSettings(change.props);
    if (Object.keys(errors).length) reject(400, 'Проверьте настройки футера', { fields: errors });
    const old = normalizeFooterSettings(site.footer_settings).settings;
    const legacy = legacyFooterDocuments(old.documents);
    if (legacyFooterDocuments(settings.documents).some(({ key, pageId }) => !legacy.some((entry) =>
        entry.pageId === pageId && (typeof key === 'number' ? typeof entry.key === 'number' : entry.key === key)))) {
        reject(400, 'Добавляйте внутренние документы как правовые страницы сайта.');
    }
    const oldUrls = old.documents.additional.flatMap(({ url }) => url ? [url] : []);
    const urls = settings.documents.additional.flatMap(({ url }) => url && !oldUrls.includes(url) ? [url] : []);
    if (urls.length) {
        const { rows } = await client.query('SELECT hostname FROM domains WHERE site_id = $1', [site.id]);
        if (urls.some((url) => isSiteFooterUrl(url, rows.map(({ hostname }) => hostname)))) {
            reject(400, 'Для документов этого сайта выберите страницу из списка, а не URL');
        }
    }
    await checkLinks(client, site.id, footerPageIds(settings), footerPageIds(old));
    const { rows: [footer] } = await client.query(
        `UPDATE sites SET footer_settings = $2::jsonb, footer_version = footer_version + 1 WHERE id = $1
         RETURNING footer_settings AS props, footer_version AS version`, [site.id, JSON.stringify(settings)],
    );
    return footer;
}

async function updateTemplate(client, siteId, template, { name, content, slotIndex }) {
    content = repairDocumentBlocks(content);
    const details = validateTemplateContent({ content, slotIndex }, partCatalog, widgetCatalog);
    if (details.length) reject(400, 'Проверьте содержимое шаблона', { details });
    await validateBlockReferences(client, siteId, content, template.content);
    const { rows: [updated] } = await client.query(
        `UPDATE page_templates SET name = $3, content = $4::jsonb, slot_index = $5, version = version + 1
         WHERE site_id = $1 AND id = $2 RETURNING ${templateColumns}`,
        [siteId, template.id, name, JSON.stringify(content), slotIndex],
    );
    return updated;
}

export async function getTemplates(c) {
    const site = await getCurrentSite(c);
    if (!site) return c.json({ error: 'Сайт не найден' }, 404);
    const { rows } = await pool.query(
        `SELECT t.id, t.name, t.is_main AS "isMain", t.version,
                COALESCE(s.default_template_id, (SELECT id FROM page_templates WHERE site_id = s.id AND is_main)) AS "defaultTemplateId",
                count(p.id) FILTER (WHERE p.template_mode = 'template' AND p.deleted_at IS NULL)::int AS explicit,
                count(p.id) FILTER (WHERE p.template_mode = 'inherit' AND p.deleted_at IS NULL)::int AS inherited,
                count(p.id) FILTER (WHERE p.deleted_at IS NOT NULL)::int AS deleted
         FROM page_templates t JOIN sites s ON s.id = t.site_id
         LEFT JOIN pages p ON p.site_id = t.site_id AND (
            p.template_id = t.id OR (p.template_mode = 'inherit' AND
            t.id = COALESCE(s.default_template_id, (SELECT id FROM page_templates WHERE site_id = s.id AND is_main))))
         WHERE t.site_id = $1 GROUP BY t.id, s.id ORDER BY t.is_main DESC, t.name, t.id`,
        [site.id],
    );
    const main = rows.find(({ isMain }) => isMain);
    if (!main) return c.json({ error: 'Основной шаблон сайта не найден' }, 409);
    return c.json({ mainTemplateId: main.id, defaultTemplateId: main.defaultTemplateId,
        templates: rows.map(({ defaultTemplateId, ...template }) => template) });
}

export async function getTemplate(c) {
    const id = c.req.param('templateId');
    if (!isUuid(id)) return c.json({ error: 'Некорректный идентификатор шаблона' }, 400);
    const site = await getCurrentSite(c);
    if (!site) return c.json({ error: 'Сайт не найден' }, 404);
    const { rows: [value] } = await pool.query(`SELECT ${templateColumns} FROM page_templates WHERE site_id = $1 AND id = $2`, [site.id, id]);
    return value ? c.json(value) : c.json({ error: 'Шаблон не найден' }, 404);
}

export async function createTemplate(c) {
    const body = await readBody(c);
    return write(c, async (client, site) => {
        if (!fields(body, ['name'])) reject(400, 'Некорректный шаблон');
        const { rows: [value] } = await client.query(
            `INSERT INTO page_templates (site_id, name, slot_index) VALUES ($1, $2, 0) RETURNING ${templateColumns}`,
            [site.id, nameOf(body.name)],
        );
        return { value, status: 201 };
    });
}

export async function putTemplate(c) {
    const body = await readBody(c);
    return write(c, async (client, site) => {
        if (!fields(body, ['name', 'content', 'slotIndex', 'expectedVersion', 'footerChanges']) || !Object.keys(body).length) {
            reject(400, 'Некорректный шаблон');
        }
        let template = await lockedTemplate(client, site.id, c.req.param('templateId'));
        const hasDocument = Object.keys(body).some((key) => key !== 'footerChanges');
        if (hasDocument) checkVersion(body.expectedVersion, template.version, 'template_conflict');
        const footer = Object.hasOwn(body, 'footerChanges') ? await saveFooter(client, site, body.footerChanges) : undefined;
        if (hasDocument) template = await updateTemplate(client, site.id, template, { ...body, name: nameOf(body.name) });
        return { value: { ...template, footer } };
    });
}

export function deleteTemplate(c) {
    return write(c, async (client, site) => {
        const template = await lockedTemplate(client, site.id, c.req.param('templateId'));
        if (template.isMain) reject(409, 'Основной шаблон нельзя удалить', { code: 'main_template' });
        const isDefault = site.default_template_id === template.id;
        const { rows: dependencies } = await client.query(
            `SELECT id, title, path, (deleted_at IS NOT NULL) AS deleted
             FROM pages WHERE site_id = $1 AND (template_id = $2 OR ($3 AND template_mode = 'inherit'))
             ORDER BY path`, [site.id, template.id, isDefault],
        );
        if (isDefault || dependencies.length) reject(409,
            isDefault ? 'Сначала выберите другой шаблон по умолчанию' : 'Шаблон используется страницами',
            { code: isDefault ? 'default_template' : 'template_in_use', dependencies, count: dependencies.length });
        await client.query('DELETE FROM page_templates WHERE site_id = $1 AND id = $2', [site.id, template.id]);
        return { status: 204 };
    });
}

export async function patchDefaultTemplate(c) {
    const body = await readBody(c);
    return write(c, async (client, site) => {
        if (!fields(body, ['templateId', 'expectedDefaultTemplateId'])
            || !(body.templateId === null || isUuid(body.templateId)) || !isUuid(body.expectedDefaultTemplateId)) {
            reject(400, 'Некорректный выбор шаблона');
        }
        const templates = await listPageTemplates(client, site.id);
        const current = resolvePageTemplate({}, site.default_template_id, templates);
        if (current.id !== body.expectedDefaultTemplateId) reject(409, 'Шаблон по умолчанию изменился', { code: 'default_template_changed' });
        const next = templates.find(({ id, isMain }) => body.templateId === null ? isMain : body.templateId === id);
        if (!next) reject(404, 'Шаблон не найден');
        await client.query('UPDATE sites SET default_template_id = $2 WHERE id = $1', [site.id, body.templateId]);
        return { value: { defaultTemplateId: next.id } };
    });
}

function validSelection(selection) {
    return fields(selection, ['mode', 'id'])
        && (selection.mode === 'template' ? isUuid(selection.id) : ['inherit', 'none'].includes(selection.mode) && selection.id === null);
}

export function putPageLayout(c, pageId, body) {
    return write(c, async (client, site) => {
        const { rows: [page] } = await client.query(
            `SELECT id, site_id, path, title, content, seo, appearance, page_type, data_source,
                    is_legal_document AS "isLegalDocument", xmin::text AS "legalVersion",
                    template_mode AS "templateMode", template_id AS "templateId"
             FROM pages WHERE site_id = $1 AND id = $2 AND deleted_at IS NULL FOR UPDATE`, [site.id, pageId],
        );
        if (!page) reject(404, 'Страница не найдена');
        const hasContent = Object.hasOwn(body, 'content');
        const hasSelection = Object.hasOwn(body, 'templateSelection');
        const hasTemplate = Object.hasOwn(body, 'templateChanges');
        const hasFooter = Object.hasOwn(body, 'footerChanges');
        const hasLegalFlag = Object.hasOwn(body, 'isLegalDocument');
        if (hasLegalFlag && (typeof body.isLegalDocument !== 'boolean' || page.page_type !== 'standard')) {
            reject(400, 'Признак правового документа доступен только обычным страницам');
        }
        const nextLegal = hasLegalFlag ? body.isLegalDocument : page.isLegalDocument;
        if (nextLegal && !isLegalPagePath(page.path)) reject(400, 'Адрес недоступен для правового документа');
        if (!hasContent && !hasSelection && !hasTemplate && !hasFooter && !hasLegalFlag) reject(400, 'Нет изменений для сохранения');
        if ((hasContent || hasSelection || hasLegalFlag) && (page.isLegalDocument || hasLegalFlag || Object.hasOwn(body, 'expectedLegalVersion'))
            && body.expectedLegalVersion !== page.legalVersion) {
            reject(409, 'Правовой документ изменился. Загрузите актуальную версию.', { code: 'legal_document_conflict' });
        }
        const selection = hasSelection ? body.templateSelection : { mode: page.templateMode, id: page.templateId };
        if (!validSelection(selection)) reject(400, 'Некорректный выбор шаблона');
        if (hasSelection || hasTemplate) {
            if (!validSelection(body.expectedSelection)) reject(400, 'Укажите сохранённый выбор шаблона');
            if (body.expectedSelection.mode !== page.templateMode || body.expectedSelection.id !== page.templateId) {
                reject(409, 'Выбор шаблона страницы изменился', { code: 'selection_conflict' });
            }
        }
        let template;
        if (hasSelection || hasTemplate) {
            const templates = await listPageTemplates(client, site.id);
            if (selection.mode === 'template' && !templates.some(({ id }) => id === selection.id)) reject(404, 'Шаблон не найден');
            const effective = resolvePageTemplate({ templateMode: selection.mode, templateId: selection.id }, site.default_template_id, templates);
            if (selection.mode === 'inherit' && body.expectedDefaultTemplateId !== effective.id) {
                reject(409, 'Шаблон по умолчанию изменился', { code: 'default_template_changed' });
            }
            if (hasTemplate) {
                const change = body.templateChanges;
                if (!fields(change, ['id', 'expectedVersion', 'propsByIndex']) || !isPlainObject(change.propsByIndex)
                    || !Object.keys(change.propsByIndex).length) reject(400, 'Некорректные изменения шаблона');
                if (change.id !== effective?.id) reject(409, 'Выбор шаблона изменился', { code: 'selection_conflict' });
                template = await lockedTemplate(client, site.id, change.id);
                checkVersion(change.expectedVersion, template.version, 'template_conflict');
                if (Object.entries(change.propsByIndex).some(([index, props]) =>
                    !/^(0|[1-9]\d*)$/.test(index) || Number(index) >= template.content.length || !isPlainObject(props))) {
                    reject(400, 'Некорректные свойства блока шаблона');
                }
            }
        }
        const footer = hasFooter ? await saveFooter(client, site, body.footerChanges) : undefined;
        if (hasContent || hasLegalFlag) {
            const content = repairDocumentBlocks(hasContent ? body.content : page.content);
            const details = validateDocumentContent(content, partCatalog, widgetCatalog, { isLegalDocument: nextLegal });
            if (details.length) reject(400, 'Проверьте содержимое страницы', { details });
            await validateBlockReferences(client, site.id, content, page.content, page);
            await client.query('UPDATE pages SET content = $3::jsonb, is_legal_document = $4 WHERE site_id = $1 AND id = $2',
                [site.id, pageId, JSON.stringify(content), nextLegal]);
            page.content = content;
            page.isLegalDocument = nextLegal;
        }
        if (hasSelection) {
            await client.query('UPDATE pages SET template_mode = $3, template_id = $4 WHERE site_id = $1 AND id = $2',
                [site.id, pageId, selection.mode, selection.id]);
            page.templateMode = selection.mode;
            page.templateId = selection.id;
        }
        if (template) {
            const { propsByIndex } = body.templateChanges;
            const content = template.content.map((block, index) => Object.hasOwn(propsByIndex, index) ? { ...block, props: propsByIndex[index] } : block);
            template = await updateTemplate(client, site.id, template, { ...template, content });
        }
        if (hasContent || hasSelection || hasLegalFlag) {
            const { rows: [revision] } = await client.query(
                'SELECT xmin::text AS "legalVersion" FROM pages WHERE site_id = $1 AND id = $2', [site.id, pageId],
            );
            page.legalVersion = revision.legalVersion;
        }
        return { value: { ...page, template, footer } };
    });
}
