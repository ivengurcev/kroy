import { getSiteContacts, normalizeSiteContacts, setSiteContacts } from '../db/siteContacts.mjs';
import getCurrentSite from './siteContext.mjs';

export async function getSiteContactSettings(c) {
    const site = await getCurrentSite(c);
    if (!site) return c.json({ error: 'Site not found' }, 404);
    return c.json(await getSiteContacts(site.id));
}

export async function patchSiteContactSettings(c) {
    let body;
    try {
        body = await c.req.json();
    } catch {
        return c.json({ error: 'Invalid contact settings' }, 400);
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return c.json({ error: 'Invalid contact settings' }, 400);
    }

    const site = await getCurrentSite(c);
    if (!site) return c.json({ error: 'Site not found' }, 404);

    try {
        const contacts = normalizeSiteContacts(body, { strictSocials: true });
        return c.json(await setSiteContacts(site.id, contacts));
    } catch (error) {
        if (/корректную HTTPS-ссылку/.test(error.message)) {
            return c.json({ error: error.message }, 400);
        }
        console.error('Failed to save site contact settings', error);
        return c.json({ error: 'Internal server error' }, 500);
    }
}
