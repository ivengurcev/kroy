import { rm } from 'node:fs/promises';
import { pool } from '../db/client.mjs';
import processImage from '../media/processImage.mjs';
import {
    MAX_UPLOAD_SIZE,
    storeMedia,
} from '../media/storage.mjs';
import getHostname from './getHostname.mjs';

const MAX_MULTIPART_SIZE = MAX_UPLOAD_SIZE + 1024 * 1024;

export default async function postMedia(c) {
    const contentType = c.req.header('Content-Type') ?? '';
    const contentLength = Number(c.req.header('Content-Length'));

    if (
        !contentType.toLowerCase().startsWith('multipart/form-data;')
        || (Number.isFinite(contentLength) && contentLength > MAX_MULTIPART_SIZE)
    ) {
        return c.json({ error: 'Invalid image' }, 400);
    }

    let form;
    let file;

    try {
        form = await c.req.raw.formData();
        file = form.get('file');
    } catch {
        return c.json({ error: 'Invalid image' }, 400);
    }

    if (
        !file
        || typeof file.arrayBuffer !== 'function'
        || !Number.isInteger(file.size)
        || file.size <= 0
        || file.size > MAX_UPLOAD_SIZE
    ) {
        return c.json({ error: 'Invalid image' }, 400);
    }

    let bytes;

    try {
        bytes = Buffer.from(await file.arrayBuffer());
    } catch {
        return c.json({ error: 'Invalid image' }, 400);
    }

    let output;

    try {
        output = await processImage(bytes, { maxWidth: form.get('maxWidth') });
    } catch {
        return c.json({ error: 'Invalid image' }, 400);
    }

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

        const siteId = sites[0].id;
        const media = await storeMedia(client, siteId, output);
        filePath = media.filePath;

        await client.query('COMMIT');
        keepFile = true;

        return c.json({ id: media.id, url: media.url }, 201);
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
