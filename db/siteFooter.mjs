import { pool } from './client.mjs';
import { prepareSiteFooter } from '../shared/footerSettings.mjs';

export async function getSiteFooterSettings(siteId, client = pool) {
    const { rows: [row] } = await client.query('SELECT footer_settings FROM sites WHERE id = $1', [siteId]);
    return row?.footer_settings ?? {};
}

export async function getSiteFooter(site, client = pool) {
    const settings = await getSiteFooterSettings(site.id, client);
    const domains = Array.isArray(settings.documents?.additional) && settings.documents.additional.some((link) => link?.url)
        ? (await client.query('SELECT hostname FROM domains WHERE site_id = $1', [site.id])).rows.map(({ hostname }) => hostname)
        : [];
    const { rows } = await client.query(
        `SELECT id, site_id, path, title, page_type AS type FROM pages
         WHERE site_id = $1 AND deleted_at IS NULL AND page_type <> 'detail' ORDER BY path`,
        [site.id],
    );
    return prepareSiteFooter({ ...site, domains }, settings, rows);
}
