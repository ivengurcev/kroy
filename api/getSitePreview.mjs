import { pool } from '../db/client.mjs';
import { getSiteTheme } from '../db/siteThemes.mjs';
import { getThemeTokens } from '../themes/themeRegistry.mjs';
import getHostname from './getHostname.mjs';

export default async function getSitePreview(c) {
    const hostname = getHostname(c);
    if (!hostname) return c.json({ error: 'Site not found' }, 404);

    try {
        const { rows } = await pool.query(
            `SELECT s.id AS site_id, p.path, p.title, p.content
             FROM sites s
             JOIN domains d ON d.site_id = s.id
             LEFT JOIN pages p ON p.site_id = s.id
              AND p.deleted_at IS NULL
             WHERE d.hostname = $1
             ORDER BY p.path`,
            [hostname],
        );

        if (rows.length === 0) return c.json({ error: 'Site not found' }, 404);

        const settings = await getSiteTheme(rows[0].site_id);
        if (!settings) return c.json({ error: 'Site not found' }, 404);

        const pages = Object.fromEntries(
            rows
                .filter(({ path }) => path !== null)
                .map(({ path, title, content }) => [path, { path, title, content }]),
        );

        return c.json({
            pages,
            theme: {
                mode: settings.themeMode,
                light: getThemeTokens(settings.themeId, 'light', settings.overrides),
                dark: getThemeTokens(settings.themeId, 'dark', settings.overrides),
            },
        });
    } catch (error) {
        console.error('Failed to load site preview', error);
        return c.json({ error: 'Internal server error' }, 500);
    }
}
