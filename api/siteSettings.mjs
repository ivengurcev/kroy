import { pool } from '../db/client.mjs';
import { getSiteContacts } from '../db/siteContacts.mjs';
import getCurrentSite from './siteContext.mjs';

export default async function getSiteSettings(c) {
    const site = await getCurrentSite(c);
    if (!site) return c.json({ error: 'Site not found' }, 404);

    const { rows: domains } = await pool.query(
        'SELECT hostname FROM domains WHERE site_id = $1 ORDER BY hostname',
        [site.id],
    );

    return c.json({
        site,
        domains: domains.map(({ hostname }) => hostname),
        contacts: await getSiteContacts(site.id),
    });
}
