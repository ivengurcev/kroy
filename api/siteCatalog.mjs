import { getCatalog, normalizeCatalog, setCatalog } from '../db/catalog.mjs';
import getCurrentSite from './siteContext.mjs';

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
        if (/Название|Цена|ссылка Prodamus|HTTPS|Изображение/.test(error.message)) return c.json({ error: error.message }, 400);
        console.error('Failed to save site catalog', error);
        return c.json({ error: 'Internal server error' }, 500);
    }
}
