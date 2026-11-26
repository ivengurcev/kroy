import { pool } from '../../db/client.mjs';
import getCurrentSite from './siteContext.mjs';
import { availableFooterPages, footerPageIds, isSiteFooterUrl, normalizeFooterSettings } from '../../shared/footerSettings.mjs';

export async function patchSiteFooter(c) {
    let body;
    try { body = await c.req.json(); }
    catch { return c.json({ error: 'Некорректные настройки футера' }, 400); }
    const { settings, fields } = normalizeFooterSettings(body);
    if (Object.keys(fields).length) return c.json({ error: 'Проверьте настройки футера', fields }, 400);
    const site = await getCurrentSite(c);
    if (!site) return c.json({ error: 'Site not found' }, 404);
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // Serialize against page deletion / path changes, as in existing settings.
        await client.query('SELECT id FROM sites WHERE id = $1 FOR UPDATE', [site.id]);
        if (settings.documents.additional.some(({ url }) => url)) {
            const { rows: domains } = await client.query('SELECT hostname FROM domains WHERE site_id = $1', [site.id]);
            if (settings.documents.additional.some(({ url }) => url && isSiteFooterUrl(url, domains.map(({ hostname }) => hostname)))) {
                await client.query('ROLLBACK');
                return c.json({ error: 'Для документов этого сайта выберите страницу из списка, а не URL' }, 400);
            }
        }
        const ids = footerPageIds(settings);
        if (ids.length) {
            const { rows } = await client.query(
                `SELECT id, site_id, path, title, page_type AS type FROM pages
                 WHERE site_id = $1 AND id = ANY($2::uuid[])
                   AND deleted_at IS NULL AND page_type <> 'detail'`,
                [site.id, ids],
            );
            const available = new Set(availableFooterPages(rows, site.id).map(({ id }) => id));
            if (ids.some((id) => !available.has(id))) {
                await client.query('ROLLBACK');
                return c.json({ error: 'Выберите доступные страницы текущего сайта' }, 400);
            }
        }
        await client.query('UPDATE sites SET footer_settings = $2::jsonb WHERE id = $1', [site.id, JSON.stringify(settings)]);
        await client.query('COMMIT');
        return c.json(settings);
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Failed to save footer settings', error);
        return c.json({ error: 'Internal server error' }, 500);
    } finally { client.release(); }
}
