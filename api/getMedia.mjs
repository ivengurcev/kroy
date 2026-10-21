import { readFile } from 'node:fs/promises';
import { pool } from '../db/client.mjs';
import { getMediaPath } from '../media/storage.mjs';
import getHostname from './getHostname.mjs';
import isUuid from './isUuid.mjs';

export default async function getMedia(c) {
    const mediaId = c.req.param('mediaId');

    if (!isUuid(mediaId)) return c.json({ error: 'Invalid UUID' }, 400);

    const hostname = getHostname(c);

    if (!hostname) return c.json({ error: 'Media not found' }, 404);

    try {
        const { rows } = await pool.query(
            `SELECT m.site_id, m.filename, m.mime_type
             FROM media m
             JOIN domains d ON d.site_id = m.site_id
             WHERE m.id = $1
               AND d.hostname = $2`,
            [mediaId, hostname]
        );
        const media = rows[0];

        if (!media) return c.json({ error: 'Media not found' }, 404);

        const filePath = getMediaPath(media.site_id, media.filename);

        if (!filePath) throw new Error('Invalid stored media path');

        const bytes = await readFile(filePath);

        return c.body(bytes, 200, {
            'Cache-Control': 'public, max-age=31536000, immutable',
            'Content-Length': String(bytes.length),
            'Content-Type': media.mime_type,
        });
    } catch (error) {
        console.error('Failed to get media', error);
        return c.json({ error: 'Internal server error' }, 500);
    }
}
