import { createMaterial, deleteMaterial, getMaterial, getMaterials, hasSiteMaterialSection, hasSiteMedia, updateMaterial } from '../../db/materials.mjs';
import { pool } from '../../db/client.mjs';
import getCurrentSite from './siteContext.mjs';
import isUuid from './isUuid.mjs';
import { materialFieldErrors, isValidMaterialSlug } from '../../shared/materialFields.mjs';

const MATERIAL_FIELDS = new Set(['sectionId', 'slug', 'title', 'summary', 'content', 'coverMediaId', 'status']);
const MATERIAL_STATUSES = new Set(['draft', 'published']);

function isPlainObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }

function isEditorNode(value, { root = false } = {}) {
    if (!isPlainObject(value) || typeof value.type !== 'string' || (root && value.type !== 'root')) return false;
    if (value.type === 'text') return typeof value.text === 'string' && !Object.hasOwn(value, 'children');
    if (!Object.hasOwn(value, 'children')) return value.type !== 'root';
    return Array.isArray(value.children) && value.children.every((child) => isEditorNode(child));
}

export function isEditorState(value) {
    return isPlainObject(value) && isPlainObject(value.root)
        && Array.isArray(value.root.children) && isEditorNode(value.root, { root: true });
}

function hasEditorText(value) {
    if (!isPlainObject(value)) return false;
    if (value.type === 'text' && typeof value.text === 'string' && value.text.trim()) return true;
    return Array.isArray(value.children) && value.children.some(hasEditorText);
}

function normalizeText(value, maxLength, { required = false } = {}) {
    if (typeof value !== 'string') return null;
    const text = value.trim();
    if (!text && required) return null;
    return text.length <= maxLength ? text : null;
}

export function normalizeMaterialInput(body, { partial = false } = {}) {
    if (!isPlainObject(body) || !Object.keys(body).length || Object.keys(body).some((key) => !MATERIAL_FIELDS.has(key))) return null;
    if (!partial && (!Object.hasOwn(body, 'sectionId') || !Object.hasOwn(body, 'slug') || !Object.hasOwn(body, 'title'))) return null;
    const material = {};
    if (Object.hasOwn(body, 'sectionId')) {
        material.sectionId = body.sectionId;
        if (!isUuid(material.sectionId)) return null;
    }
    if (Object.hasOwn(body, 'slug')) {
        if (typeof body.slug !== 'string') return null;
        material.slug = body.slug.trim();
        if (!isValidMaterialSlug(material.slug)) return null;
    }
    if (Object.hasOwn(body, 'title')) {
        material.title = normalizeText(body.title, 300, { required: true });
        if (!material.title) return null;
    }
    if (Object.hasOwn(body, 'summary')) {
        material.summary = normalizeText(body.summary, 2000);
        if (material.summary === null) return null;
    }
    if (Object.hasOwn(body, 'content')) {
        material.content = body.content === null || isEditorState(body.content) ? body.content : undefined;
        if (material.content === undefined) return null;
    }
    if (Object.hasOwn(body, 'coverMediaId')) {
        material.coverMediaId = body.coverMediaId === null || body.coverMediaId === '' ? null : body.coverMediaId;
        if (material.coverMediaId !== null && !isUuid(material.coverMediaId)) return null;
    }
    if (Object.hasOwn(body, 'status')) {
        if (!MATERIAL_STATUSES.has(body.status)) return null;
        material.status = body.status;
    }
    if (!partial) {
        material.summary ??= '';
        material.content ??= null;
        material.coverMediaId ??= null;
        material.status ??= 'draft';
    }
    return material;
}

export function isPublishableMaterial(material) {
    return material.status !== 'published' || isEditorState(material.content) && hasEditorText(material.content.root);
}

function inputFieldErrors(body, options) {
    const fields = materialFieldErrors(body, options);
    if (body?.content !== undefined && body.content !== null && !isEditorState(body.content)) fields.content = 'Не удалось прочитать текст материала. Обновите страницу и повторите ввод';
    return fields;
}

async function readBody(c) { try { return await c.req.json(); } catch { return undefined; } }

export async function getSiteMaterials(c) {
    try {
        const site = await getCurrentSite(c);
        if (!site) return c.json({ error: 'Site not found' }, 404);
        const sectionId = c.req.query('sectionId');
        if (sectionId !== undefined && !isUuid(sectionId)) return c.json({ error: 'Invalid sectionId' }, 400);
        return c.json(await getMaterials(site.id, sectionId === undefined ? {} : { sectionId }));
    } catch (error) {
        console.error('Failed to get materials', error);
        return c.json({ error: 'Internal server error' }, 500);
    }
}

export async function getSiteMaterial(c) {
    const id = c.req.param('id');
    if (!isUuid(id)) return c.json({ error: 'Invalid UUID' }, 400);
    try {
        const site = await getCurrentSite(c);
        if (!site) return c.json({ error: 'Site not found' }, 404);
        const material = await getMaterial(site.id, id);
        return material ? c.json(material) : c.json({ error: 'Material not found' }, 404);
    } catch (error) {
        console.error('Failed to get material', error);
        return c.json({ error: 'Internal server error' }, 500);
    }
}

export async function postSiteMaterial(c) {
    const body = await readBody(c);
    const material = normalizeMaterialInput(body);
    if (!material) return c.json({ error: 'Проверьте поля материала', fields: inputFieldErrors(body) }, 400);
    if (!isPublishableMaterial(material)) return c.json({ error: 'Добавьте текст материала', fields: { content: 'Добавьте текст материала или выберите статус «Черновик»' } }, 400);
    try {
        const site = await getCurrentSite(c);
        if (!site) return c.json({ error: 'Site not found' }, 404);
        if (!(await hasSiteMaterialSection(site.id, material.sectionId))) return c.json({ error: 'Выберите раздел', fields: { sectionId: 'Выберите доступный раздел' } }, 400);
        if (material.coverMediaId !== null && !(await hasSiteMedia(site.id, material.coverMediaId))) return c.json({ error: 'Изображение недоступно', fields: { coverMediaId: 'Загрузите изображение повторно' } }, 400);
        const created = await createMaterial(site.id, material);
        return created ? c.json(created, 201) : c.json({ error: 'Invalid material section or cover media' }, 400);
    } catch (error) {
        if (error.code === '23505') return c.json({ error: 'Такой адрес уже используется', fields: { slug: 'Такой адрес уже используется' } }, 409);
        console.error('Failed to create material', error);
        return c.json({ error: 'Internal server error' }, 500);
    }
}

export async function patchSiteMaterial(c) {
    const id = c.req.param('id');
    if (!isUuid(id)) return c.json({ error: 'Invalid UUID' }, 400);
    const body = await readBody(c);
    const changes = normalizeMaterialInput(body, { partial: true });
    if (!changes) return c.json({ error: 'Проверьте поля материала', fields: inputFieldErrors(body, { partial: true }) }, 400);
    try {
        const site = await getCurrentSite(c);
        if (!site) return c.json({ error: 'Site not found' }, 404);
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const current = await getMaterial(site.id, id, client, { forUpdate: true });
            if (!current) {
                await client.query('ROLLBACK');
                return c.json({ error: 'Material not found' }, 404);
            }
            const next = { ...current, ...changes };
            if (!isPublishableMaterial(next)) {
                await client.query('ROLLBACK');
                return c.json({ error: 'Добавьте текст материала', fields: { content: 'Добавьте текст материала или выберите статус «Черновик»' } }, 400);
            }
            if (changes.sectionId && !(await hasSiteMaterialSection(site.id, changes.sectionId, client))) {
                await client.query('ROLLBACK');
                return c.json({ error: 'Выберите раздел', fields: { sectionId: 'Выберите доступный раздел' } }, 400);
            }
            if (changes.coverMediaId !== undefined && changes.coverMediaId !== null
                && !(await hasSiteMedia(site.id, changes.coverMediaId, client))) {
                await client.query('ROLLBACK');
                return c.json({ error: 'Изображение недоступно', fields: { coverMediaId: 'Загрузите изображение повторно' } }, 400);
            }
            const updated = await updateMaterial(site.id, id, changes, client);
            if (!updated) {
                await client.query('ROLLBACK');
                return c.json({ error: 'Material not found' }, 404);
            }
            await client.query('COMMIT');
            return c.json(updated);
        } catch (error) {
            await client.query('ROLLBACK').catch(() => {});
            throw error;
        } finally { client.release(); }
    } catch (error) {
        if (error.code === '23505') return c.json({ error: 'Такой адрес уже используется', fields: { slug: 'Такой адрес уже используется' } }, 409);
        console.error('Failed to update material', error);
        return c.json({ error: 'Internal server error' }, 500);
    }
}

export async function deleteSiteMaterial(c) {
    const id = c.req.param('id');
    if (!isUuid(id)) return c.json({ error: 'Invalid UUID' }, 400);
    try {
        const site = await getCurrentSite(c);
        if (!site) return c.json({ error: 'Site not found' }, 404);
        return await deleteMaterial(site.id, id) ? c.body(null, 204) : c.json({ error: 'Material not found' }, 404);
    } catch (error) {
        console.error('Failed to delete material', error);
        return c.json({ error: 'Internal server error' }, 500);
    }
}
