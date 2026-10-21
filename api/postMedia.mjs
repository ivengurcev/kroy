import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { pool } from '../db/client.mjs';
import {
    detectImageFormat,
    getMediaPath,
    MAX_MEDIA_SIZE,
} from '../media/storage.mjs';
import getHostname from './getHostname.mjs';

const MAX_MULTIPART_SIZE = MAX_MEDIA_SIZE + 1024 * 1024;

export default async function postMedia(c) {
    const contentType = c.req.header('Content-Type') ?? '';
    const contentLength = Number(c.req.header('Content-Length'));

    if (
        !contentType.toLowerCase().startsWith('multipart/form-data;')
        || (Number.isFinite(contentLength) && contentLength > MAX_MULTIPART_SIZE)
    ) {
        return c.json({ error: 'Invalid image' }, 400);
    }

    let file;

    try {
        const form = await c.req.raw.formData();
        file = form.get('file');
    } catch {
        return c.json({ error: 'Invalid image' }, 400);
    }

    if (
        !file
        || typeof file.arrayBuffer !== 'function'
        || !Number.isInteger(file.size)
        || file.size <= 0
        || file.size > MAX_MEDIA_SIZE
    ) {
        return c.json({ error: 'Invalid image' }, 400);
    }

    let bytes;

    try {
        bytes = Buffer.from(await file.arrayBuffer());
    } catch {
        return c.json({ error: 'Invalid image' }, 400);
    }

    const format = detectImageFormat(bytes);

    if (!format) return c.json({ error: 'Invalid image' }, 400);

    const hostname = getHostname(c);

    if (!hostname) return c.json({ error: 'Site not found' }, 404);

    let client;
    let filePath;
    let keepFile = false;

    try {
        client = await pool.connect();
        await client.query('BEGIN');

        const { rows: sites } = await client.query(
            `SELECT s.id
             FROM sites s
             JOIN domains d ON d.site_id = s.id
             WHERE d.hostname = $1`,
            [hostname]
        );

        if (sites.length === 0) {
            await client.query('ROLLBACK');
            return c.json({ error: 'Site not found' }, 404);
        }

        const id = randomUUID();
        const filename = `${id}.${format.extension}`;
        const siteId = sites[0].id;
        filePath = getMediaPath(siteId, filename);

        if (!filePath) throw new Error('Invalid generated media path');

        await mkdir(dirname(filePath), { recursive: true });
        await writeFile(filePath, bytes, { flag: 'wx' });

        await client.query(
            `INSERT INTO media (id, site_id, filename, mime_type, size)
             VALUES ($1, $2, $3, $4, $5)`,
            [id, siteId, filename, format.mimeType, bytes.length]
        );

        await client.query('COMMIT');
        keepFile = true;

        return c.json({ id, url: `/api/media/${id}` }, 201);
    } catch (error) {
        await client?.query('ROLLBACK').catch(() => {});
        console.error('Failed to upload media', error);
        return c.json({ error: 'Internal server error' }, 500);
    } finally {
        if (filePath && !keepFile) {
            await rm(filePath, { force: true }).catch((error) => {
                console.error('Failed to remove incomplete media', error);
            });
        }
        client?.release();
    }
}
