import { countUncategorizedProducts, deleteCatalogCategory, deleteCatalogProduct, getCatalog, listCatalogCategories, listCatalogProducts, normalizeCatalog, normalizeCategory, normalizeProduct, saveCatalogCategory, saveCatalogProduct, setCatalog } from '../../db/catalog.mjs';
import getCurrentSite from './siteContext.mjs';
import isUuid from './isUuid.mjs';

const validationMessage = /Название|Цена|Тип позиции|Изображение|раздел|Раздел|идентификатор|Некорректные/;

async function readJson(c) {
    try { return await c.req.json(); } catch { return null; }
}

function writeError(c, error) {
    if (validationMessage.test(error.message)) return c.json({ error: error.message }, 400);
    console.error('Failed to save catalog record', error);
    return c.json({ error: 'Internal server error' }, 500);
}

export async function getSiteCatalog(c) {
    const site = await getCurrentSite(c);
    if (!site) return c.json({ error: 'Site not found' }, 404);
    return c.json(await getCatalog(site.id));
}

export async function patchSiteCatalog(c) {
    let body;
    try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid catalog' }, 400); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return c.json({ error: 'Invalid catalog' }, 400);
    const site = await getCurrentSite(c);
    if (!site) return c.json({ error: 'Site not found' }, 404);
    try {
        return c.json(await setCatalog(site.id, normalizeCatalog(body)));
    } catch (error) {
        if (/Название|Цена|Тип позиции|Изображение/.test(error.message)) return c.json({ error: error.message }, 400);
        console.error('Failed to save site catalog', error);
        return c.json({ error: 'Internal server error' }, 500);
    }
}

export async function getSiteCatalogCategories(c) {
    const site = await getCurrentSite(c);
    if (!site) return c.json({ error: 'Site not found' }, 404);
    const [categories, uncategorizedCount] = await Promise.all([listCatalogCategories(site.id), countUncategorizedProducts(site.id)]);
    return c.json({ categories, uncategorizedCount });
}

export async function saveSiteCatalogCategory(c) {
    const body = await readJson(c);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return c.json({ error: 'Invalid category' }, 400);
    const pathId = c.req.param('id');
    if (pathId && (!isUuid(pathId) || body.id && body.id !== pathId)) return c.json({ error: 'Invalid category id' }, 400);
    if (pathId) body.id = pathId;
    try {
        normalizeCategory(body);
        const site = await getCurrentSite(c);
        if (!site) return c.json({ error: 'Site not found' }, 404);
        const category = await saveCatalogCategory(site.id, body);
        return category ? c.json(category, body.id ? 200 : 201) : c.json({ error: 'Category not found' }, 404);
    } catch (error) { return writeError(c, error); }
}

export async function deleteSiteCatalogCategory(c) {
    const id = c.req.param('id');
    if (!isUuid(id)) return c.json({ error: 'Invalid UUID' }, 400);
    const site = await getCurrentSite(c);
    if (!site) return c.json({ error: 'Site not found' }, 404);
    const deleted = await deleteCatalogCategory(site.id, id);
    return deleted ? c.body(null, 204) : c.json({ error: 'Category not found' }, 404);
}

export async function getSiteCatalogProducts(c) {
    const site = await getCurrentSite(c);
    if (!site) return c.json({ error: 'Site not found' }, 404);
    const query = c.req.query();
    const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 50));
    const offset = Math.max(0, Number.parseInt(query.offset, 10) || 0);
    if (query.categoryId && query.categoryId !== 'null' && !isUuid(query.categoryId)) return c.json({ error: 'Invalid categoryId' }, 400);
    if (query.type && !['service', 'goods'].includes(query.type)) return c.json({ error: 'Invalid type' }, 400);
    if (query.status && !['published', 'hidden'].includes(query.status)) return c.json({ error: 'Invalid status' }, 400);
    return c.json(await listCatalogProducts(site.id, { categoryId: query.categoryId, search: (query.search || '').slice(0, 200), type: query.type, status: query.status, limit, offset }));
}

export async function saveSiteCatalogProduct(c) {
    const body = await readJson(c);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return c.json({ error: 'Invalid product' }, 400);
    const pathId = c.req.param('id');
    if (pathId && (!isUuid(pathId) || body.id && body.id !== pathId)) return c.json({ error: 'Invalid product id' }, 400);
    if (pathId) body.id = pathId;
    try {
        normalizeProduct(body);
        const site = await getCurrentSite(c);
        if (!site) return c.json({ error: 'Site not found' }, 404);
        const product = await saveCatalogProduct(site.id, body);
        return product ? c.json(product, body.id ? 200 : 201) : c.json({ error: 'Product not found' }, 404);
    } catch (error) { return writeError(c, error); }
}

export async function deleteSiteCatalogProduct(c) {
    const id = c.req.param('id');
    if (!isUuid(id)) return c.json({ error: 'Invalid UUID' }, 400);
    const site = await getCurrentSite(c);
    if (!site) return c.json({ error: 'Site not found' }, 404);
    const deleted = await deleteCatalogProduct(site.id, id);
    return deleted ? c.body(null, 204) : c.json({ error: 'Product not found' }, 404);
}
