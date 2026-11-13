import { pool } from '../../db/client.mjs';
import getCurrentSite from './siteContext.mjs';
import { normalizeSeo } from '../../shared/seo.mjs';
import { seoReferenceErrors } from './seoValidation.mjs';

export async function patchSiteSeo(c) {
    let body;
    try { body = await c.req.json(); }
    catch { return c.json({ error: 'Некорректные SEO-настройки' }, 400); }
    const { seo, fields } = normalizeSeo(body, { site: true });
    if (Object.keys(fields).length) return c.json({ error: 'Проверьте SEO-настройки', fields }, 400);
    const site = await getCurrentSite(c);
    if (!site) return c.json({ error: 'Site not found' }, 404);
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('SELECT id FROM sites WHERE id = $1 FOR UPDATE', [site.id]);
        const errors = await seoReferenceErrors(client, site.id, seo);
        if (Object.keys(errors).length) {
            await client.query('ROLLBACK');
            return c.json({ error: 'Проверьте SEO-настройки', fields: errors }, 400);
        }
        await client.query('UPDATE sites SET seo = $2::jsonb WHERE id = $1', [site.id, JSON.stringify(seo)]);
        await client.query('COMMIT');
        return c.json(seo);
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Failed to save SEO settings', error);
        return c.json({ error: 'Internal server error' }, 500);
    } finally { client.release(); }
}
