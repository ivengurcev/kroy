import { pool } from './client.mjs';

// Read saved data, including deletions, in one SQL snapshot. No mutable dirty flag.
// Only a digest is stored with the release; private settings never enter artifacts.
export async function getSiteFingerprint(siteId, client = pool) {
    const tables = ['pages', 'redirects', 'domains', 'material_sections', 'materials', 'product_categories', 'products', 'reviews'];
    const collections = tables.map((table) => `
        '${table}', (SELECT coalesce(jsonb_agg(record ORDER BY record::text), '[]'::jsonb)
            FROM (SELECT to_jsonb(t) - 'created_at' - 'updated_at' - 'published_at' - 'moderated_at' AS record
                  FROM ${table} t WHERE site_id = $1) records)`);
    const { rows: [row] } = await client.query(`
        SELECT md5(jsonb_build_object(
            'site', (SELECT jsonb_build_object('name', name, 'theme_id', theme_id,
                'theme_mode', theme_mode, 'theme_overrides', theme_overrides, 'contact_settings', contact_settings)
                FROM sites WHERE id = $1),
            ${collections.join(',')}
        )::text) AS fingerprint`, [siteId]);
    return row.fingerprint;
}
