import { createMaterialSection, deleteMaterialSection, getMaterialSections, getMaterialSection, hasMaterialSectionReferences, updateMaterialSection } from '../../db/materialSections.mjs';
import getCurrentSite from './siteContext.mjs';
import { pool } from '../../db/client.mjs';
import isUuid from './isUuid.mjs';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeMaterialSectionInput(body, { partial = false } = {}) {
    if (!isPlainObject(body) || !Object.keys(body).length
        || Object.keys(body).some((key) => !['name', 'slug', 'sortOrder'].includes(key))) return null;
    if (!partial && (!Object.hasOwn(body, 'name') || !Object.hasOwn(body, 'slug'))) return null;
    const section = {};
    if (Object.hasOwn(body, 'name')) {
        if (typeof body.name !== 'string') return null;
        section.name = body.name.trim();
        if (!section.name || section.name.length > 200) return null;
    }
    if (Object.hasOwn(body, 'slug')) {
        if (typeof body.slug !== 'string') return null;
        section.slug = body.slug.trim();
        if (section.slug.length > 200 || !SLUG_PATTERN.test(section.slug)) return null;
    }
    if (Object.hasOwn(body, 'sortOrder')) {
        if (!Number.isSafeInteger(body.sortOrder)) return null;
        section.sortOrder = body.sortOrder;
    } else if (!partial) section.sortOrder = 0;
    return section;
}

async function readBody(c) {
    try { return await c.req.json(); } catch { return undefined; }
}

export async function getSiteMaterialSections(c) {
    try {
        const site = await getCurrentSite(c);
        if (!site) return c.json({ error: 'Site not found' }, 404);
        const sections = await getMaterialSections(site.id);
        return c.json(await Promise.all(sections.map(async (section) => ({
            ...section, canDelete: !await hasMaterialSectionReferences(site.id, section.id),
        }))));
    } catch (error) {
        console.error('Failed to get material sections', error);
        return c.json({ error: 'Internal server error' }, 500);
    }
}

export async function postSiteMaterialSection(c) {
    const section = normalizeMaterialSectionInput(await readBody(c));
    if (!section) return c.json({ error: 'Проверьте название раздела', fields: { name: 'Укажите название не длиннее 200 символов' } }, 400);
    try {
        const site = await getCurrentSite(c);
        if (!site) return c.json({ error: 'Site not found' }, 404);
        return c.json({ ...await createMaterialSection(site.id, section), canDelete: true }, 201);
    } catch (error) {
        if (error.code === '23505') return c.json({ error: 'Такой адрес уже используется', fields: { name: 'Раздел с таким адресом уже существует. Укажите другое название' } }, 409);
        console.error('Failed to create material section', error);
        return c.json({ error: 'Internal server error' }, 500);
    }
}

export async function patchSiteMaterialSection(c) {
    const id = c.req.param('id');
    const changes = normalizeMaterialSectionInput(await readBody(c), { partial: true });
    if (!isUuid(id)) return c.json({ error: 'Invalid UUID' }, 400);
    if (!changes) return c.json({ error: 'Проверьте название раздела', fields: { name: 'Укажите название не длиннее 200 символов' } }, 400);
    try {
        const site = await getCurrentSite(c);
        if (!site) return c.json({ error: 'Site not found' }, 404);
        const updated = await updateMaterialSection(site.id, id, changes);
        return updated ? c.json({ ...updated, canDelete: !await hasMaterialSectionReferences(site.id, id) }) : c.json({ error: 'Material section not found' }, 404);
    } catch (error) {
        if (error.code === '23505') return c.json({ error: 'Такой адрес уже используется', fields: { name: 'Раздел с таким адресом уже существует. Укажите другое название' } }, 409);
        console.error('Failed to update material section', error);
        return c.json({ error: 'Internal server error' }, 500);
    }
}

export async function deleteSiteMaterialSection(c) {
    const id = c.req.param('id');
    if (!isUuid(id)) return c.json({ error: 'Invalid UUID' }, 400);
    let client;
    try {
        const site = await getCurrentSite(c);
        if (!site) return c.json({ error: 'Site not found' }, 404);
        client = await pool.connect();
        await client.query('BEGIN');
        const section = await getMaterialSection(site.id, id, client, { forUpdate: true });
        if (!section) {
            await client.query('ROLLBACK');
            return c.json({ error: 'Material section not found' }, 404);
        }
        if (await hasMaterialSectionReferences(site.id, id, client)) {
            await client.query('ROLLBACK');
            return c.json({ error: 'Material section is in use' }, 409);
        }
        await deleteMaterialSection(site.id, id, client);
        await client.query('COMMIT');
        return c.body(null, 204);
    } catch (error) {
        await client?.query('ROLLBACK').catch(() => {});
        if (error.code === '23503') return c.json({ error: 'Material section is in use' }, 409);
        console.error('Failed to delete material section', error);
        return c.json({ error: 'Internal server error' }, 500);
    } finally {
        client?.release();
    }
}
