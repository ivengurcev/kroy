import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import sharp from 'sharp';
import { pool } from '../db/client.mjs';
import {
    DEFAULT_MEDIA_WIDTH,
    getMediaPath,
    MAX_MEDIA_PIXELS,
    MAX_MEDIA_SIZE,
    MAX_MEDIA_WIDTH,
    MAX_UPLOAD_SIZE,
} from '../media/storage.mjs';
import getHostname from './getHostname.mjs';

const MAX_MULTIPART_SIZE = MAX_UPLOAD_SIZE + 1024 * 1024;

sharp.cache({ memory: 64, files: 0, items: 100 });
sharp.concurrency(1);

function requestedWidth(value) {
    const width = Number(value);
    return Number.isInteger(width) && width > 0
        ? Math.min(width, MAX_MEDIA_WIDTH)
        : DEFAULT_MEDIA_WIDTH;
}

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

    let metadata;
    let output;

    try {
        const image = sharp(bytes, {
            limitInputPixels: MAX_MEDIA_PIXELS,
            sequentialRead: true,
        });
        metadata = await image.metadata();

        if (
            !['jpeg', 'png', 'webp'].includes(metadata.format)
            || !Number.isInteger(metadata.width)
            || !Number.isInteger(metadata.height)
            || metadata.width <= 0
            || metadata.height <= 0
            || metadata.width * metadata.height > MAX_MEDIA_PIXELS
        ) {
            return c.json({ error: 'Invalid image' }, 400);
        }

        output = await image
            .rotate()
            .resize({ width: requestedWidth(form.get('maxWidth')), withoutEnlargement: true })
            .webp({ quality: 82 })
            .toBuffer();
    } catch {
        return c.json({ error: 'Invalid image' }, 400);
    }

    if (output.length <= 0 || output.length > MAX_MEDIA_SIZE) {
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

        const id = randomUUID();
        const filename = `${id}.webp`;
        const siteId = sites[0].id;
        filePath = getMediaPath(siteId, filename);

        if (!filePath) throw new Error('Invalid generated media path');

        await mkdir(dirname(filePath), { recursive: true });
        await writeFile(filePath, output, { flag: 'wx' });

        await client.query(
            `INSERT INTO media (id, site_id, filename, mime_type, size)
             VALUES ($1, $2, $3, $4, $5)`,
            [id, siteId, filename, 'image/webp', output.length]
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
