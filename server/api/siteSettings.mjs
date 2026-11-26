import { pool } from '../../db/client.mjs';
import { getSiteContacts } from '../../db/siteContacts.mjs';
import getCurrentSite from './siteContext.mjs';

export default async function getSiteSettings(c) {
    const site = await getCurrentSite(c);
    if (!site) return c.json({ error: 'Site not found' }, 404);

    const { rows: domains } = await pool.query(
        'SELECT hostname FROM domains WHERE site_id = $1 ORDER BY hostname',
        [site.id],
    );

    const { rows: [settings] } = await pool.query(
        `SELECT seo, footer_settings, footer_version,
                COALESCE(default_template_id, (SELECT id FROM page_templates WHERE site_id = sites.id AND is_main))
                    AS "defaultTemplateId"
         FROM sites WHERE id = $1`, [site.id],
    );
    return c.json({
        site,
        seo: settings.seo,
        domains: domains.map(({ hostname }) => hostname),
        contacts: await getSiteContacts(site.id),
        footer: { props: settings.footer_settings, version: settings.footer_version },
        defaultTemplateId: settings.defaultTemplateId,
    });
}
