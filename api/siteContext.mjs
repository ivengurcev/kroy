import { pool } from '../db/client.mjs';
import getHostname from './getHostname.mjs';

export default async function getCurrentSite(c) {
    const hostname = getHostname(c);
    if (!hostname) return null;

    const { rows: [site] } = await pool.query(
        `SELECT s.id, s.slug, s.name
         FROM sites s
         JOIN domains d ON d.site_id = s.id
         WHERE d.hostname = $1`,
        [hostname],
    );

    return site ?? null;
}
