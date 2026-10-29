import { isIP } from 'node:net';
import { rm } from 'node:fs/promises';
import { pool } from '../db/client.mjs';
import { createReview, deleteReview, getReviews, updateReview } from '../db/reviews.mjs';
import processImage from '../media/processImage.mjs';
import { MAX_MEDIA_SIZE, storeMedia } from '../media/storage.mjs';
import getCurrentSite from './siteContext.mjs';
import isUuid from './isUuid.mjs';

const MAX_BODY_SIZE = 16 * 1024;
const MAX_MULTIPART_SIZE = MAX_MEDIA_SIZE + 1024 * 1024;
const PUBLIC_IMAGE_WIDTH = 800;
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const MAX_RATE_LIMIT_KEYS = 10000;
const PUBLIC_FIELDS = new Set(['authorName', 'authorSubtitle', 'text', 'mediaId', 'website']);
const ADMIN_FIELDS = new Set(['authorName', 'authorSubtitle', 'text', 'mediaId', 'reviewDate', 'status']);
const REVIEW_STATUSES = new Set(['pending', 'published', 'rejected']);
const submissions = new Map();

function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

async function readJson(c) {
    const contentType = c.req.header('Content-Type') ?? '';
    const contentLengthHeader = c.req.header('Content-Length');
    const contentLength = contentLengthHeader === undefined ? null : Number(contentLengthHeader);
    if (!/^application\/json(?:\s*;|$)/i.test(contentType)
        || (contentLength !== null && (!Number.isInteger(contentLength) || contentLength < 0 || contentLength > MAX_BODY_SIZE))) {
        throw new Error('INVALID_BODY');
    }

    const reader = c.req.raw.body?.getReader();
    if (!reader) throw new Error('INVALID_BODY');
    const chunks = [];
    let size = 0;
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_BODY_SIZE) {
            await reader.cancel().catch(() => {});
            throw new Error('BODY_TOO_LARGE');
        }
        chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
    }
    try {
        return JSON.parse(new TextDecoder().decode(bytes));
    } catch {
        throw new Error('INVALID_BODY');
    }
}

async function readMultipart(c) {
    const contentType = c.req.header('Content-Type') ?? '';
    const contentLength = Number(c.req.header('Content-Length'));
    if (!contentType.toLowerCase().startsWith('multipart/form-data;')
        || !Number.isInteger(contentLength)
        || contentLength <= 0
        || contentLength > MAX_MULTIPART_SIZE) {
        throw new Error(contentLength > MAX_MULTIPART_SIZE ? 'BODY_TOO_LARGE' : 'INVALID_BODY');
    }

    let form;
    try {
        form = await c.req.raw.formData();
    } catch {
        throw new Error('INVALID_BODY');
    }

    const field = (name) => {
        const value = form.get(name);
        return typeof value === 'string' ? value : undefined;
    };
    const photo = form.get('photo');
    if (photo !== null && (
        typeof photo.arrayBuffer !== 'function'
        || !Number.isInteger(photo.size)
        || photo.size <= 0
        || photo.size > MAX_MEDIA_SIZE
    )) {
        throw new Error('INVALID_BODY');
    }

    return {
        body: {
            authorName: field('authorName'),
            authorSubtitle: field('authorSubtitle'),
            text: field('text'),
            website: field('website'),
        },
        photo,
    };
}

function normalizeRequiredText(value, maxLength) {
    if (typeof value !== 'string') return null;
    const result = value.trim();
    return result && result.length <= maxLength ? result : null;
}

function normalizeOptionalText(value, maxLength) {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value !== 'string') return undefined;
    const result = value.trim();
    if (!result) return null;
    return result.length <= maxLength ? result : undefined;
}

function normalizePublicReview(body) {
    if (!isPlainObject(body) || Object.keys(body).some((key) => !PUBLIC_FIELDS.has(key))) return null;
    const authorName = normalizeRequiredText(body.authorName, 200);
    const authorSubtitle = normalizeOptionalText(body.authorSubtitle, 300);
    const text = normalizeRequiredText(body.text, 5000);
    const rawMediaId = typeof body.mediaId === 'string' ? body.mediaId.trim() : body.mediaId;
    const mediaId = rawMediaId === undefined || rawMediaId === null || rawMediaId === ''
        ? null
        : typeof rawMediaId === 'string' && isUuid(rawMediaId) ? rawMediaId : undefined;
    if (!authorName || authorSubtitle === undefined || !text || mediaId === undefined
        || (body.website !== undefined && typeof body.website !== 'string')) return null;
    return { authorName, authorSubtitle, text, mediaId };
}

function normalizeReviewDate(value) {
    if (typeof value !== 'string' || !/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value ? value : null;
}

function normalizeAdminReview(body, { partial = false } = {}) {
    if (!isPlainObject(body) || Object.keys(body).length === 0
        || Object.keys(body).some((key) => !ADMIN_FIELDS.has(key))) return null;
    if (!partial && (!Object.hasOwn(body, 'authorName') || !Object.hasOwn(body, 'text'))) return null;

    const review = {};
    if (Object.hasOwn(body, 'authorName')) {
        review.authorName = normalizeRequiredText(body.authorName, 200);
        if (!review.authorName) return null;
    }
    if (Object.hasOwn(body, 'authorSubtitle')) {
        review.authorSubtitle = normalizeOptionalText(body.authorSubtitle, 300);
        if (review.authorSubtitle === undefined) return null;
    }
    if (Object.hasOwn(body, 'text')) {
        review.text = normalizeRequiredText(body.text, 5000);
        if (!review.text) return null;
    }
    if (Object.hasOwn(body, 'mediaId')) {
        const rawMediaId = typeof body.mediaId === 'string' ? body.mediaId.trim() : body.mediaId;
        review.mediaId = rawMediaId === null || rawMediaId === '' ? null : rawMediaId;
        if (review.mediaId !== null && (typeof review.mediaId !== 'string' || !isUuid(review.mediaId))) return null;
    }
    if (Object.hasOwn(body, 'reviewDate')) {
        review.reviewDate = normalizeReviewDate(body.reviewDate);
        if (!review.reviewDate) return null;
    }
    if (Object.hasOwn(body, 'status')) {
        if (!REVIEW_STATUSES.has(body.status)) return null;
        review.status = body.status;
    }
    return review;
}

function normalizedIp(value) {
    if (typeof value !== 'string') return null;
    const ip = value.trim().replace(/^::ffff:/i, '');
    return isIP(ip) ? ip : null;
}

function isTrustedProxy(ip) {
    if (!ip) return false;
    if (ip === '::1' || ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80:')) return true;
    if (isIP(ip) !== 4) return false;
    const [first, second] = ip.split('.').map(Number);
    return first === 127
        || first === 10
        || first === 192 && second === 168
        || first === 172 && second >= 16 && second <= 31;
}

function clientIp(c) {
    const remoteIp = normalizedIp(c.env?.incoming?.socket?.remoteAddress);
    if (isTrustedProxy(remoteIp)) {
        const realIp = normalizedIp(c.req.header('X-Real-IP'));
        if (realIp) return realIp;
    }
    return remoteIp ?? 'unknown';
}

function retryAfter(key, now = Date.now()) {
    let entry = submissions.get(key);
    if (!entry || entry.resetAt <= now) {
        if (!entry && submissions.size >= MAX_RATE_LIMIT_KEYS) {
            submissions.delete(submissions.keys().next().value);
        }
        submissions.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
        return 0;
    }
    if (entry.count >= RATE_LIMIT) return Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
    entry.count += 1;
    return 0;
}

export async function postReview(c) {
    try {
        const site = await getCurrentSite(c);
        if (!site) return c.json({ error: 'Site not found' }, 404);
        const wait = retryAfter(`${site.id}:${clientIp(c)}`);
        if (wait) return c.json({ error: 'Too many requests' }, 429, { 'Retry-After': String(wait) });

        const multipart = (c.req.header('Content-Type') ?? '').toLowerCase().startsWith('multipart/form-data;');
        let body;
        let photo;
        try {
            if (multipart) {
                ({ body, photo } = await readMultipart(c));
            } else {
                body = await readJson(c);
            }
        } catch (error) {
            return c.json({ error: error.message === 'BODY_TOO_LARGE' ? 'Request body too large' : 'Invalid review' }, error.message === 'BODY_TOO_LARGE' ? 413 : 400);
        }

        if (typeof body?.website === 'string' && body.website.trim()) return c.json({ status: 'pending' }, 201);

        const review = normalizePublicReview(body);
        if (!review) return c.json({ error: 'Invalid review' }, 400);
        if (!photo) {
            if (!(await createReview(site.id, review))) return c.json({ error: 'Invalid media' }, 400);
            return c.json({ status: 'pending' }, 201);
        }

        let output;
        try {
            output = await processImage(Buffer.from(await photo.arrayBuffer()), {
                maxWidth: PUBLIC_IMAGE_WIDTH,
                square: true,
            });
        } catch {
            return c.json({ error: 'Invalid image' }, 400);
        }

        let client;
        let filePath;
        let keepFile = false;
        try {
            client = await pool.connect();
            await client.query('BEGIN');
            const media = await storeMedia(client, site.id, output);
            filePath = media.filePath;
            const created = await createReview(site.id, { ...review, mediaId: media.id }, client);
            if (!created) throw new Error('Invalid media');
            await client.query('COMMIT');
            keepFile = true;
        } catch (error) {
            await client?.query('ROLLBACK').catch(() => {});
            throw error;
        } finally {
            if (filePath && !keepFile) {
                await rm(filePath, { force: true }).catch((error) => {
                    console.error('Failed to remove incomplete review media', error);
                });
            }
            client?.release();
        }
        return c.json({ status: 'pending' }, 201);
    } catch (error) {
        console.error('Failed to create review', error);
        return c.json({ error: 'Internal server error' }, 500);
    }
}

export async function getSiteReviews(c) {
    const status = c.req.query('status');
    if (status !== undefined && !REVIEW_STATUSES.has(status)) return c.json({ error: 'Invalid status' }, 400);
    try {
        const site = await getCurrentSite(c);
        if (!site) return c.json({ error: 'Site not found' }, 404);
        return c.json(await getReviews(site.id, status));
    } catch (error) {
        console.error('Failed to get reviews', error);
        return c.json({ error: 'Internal server error' }, 500);
    }
}

export async function postSiteReview(c) {
    let body;
    try {
        body = await readJson(c);
    } catch (error) {
        return c.json({ error: error.message === 'BODY_TOO_LARGE' ? 'Request body too large' : 'Invalid review' }, error.message === 'BODY_TOO_LARGE' ? 413 : 400);
    }
    const review = normalizeAdminReview(body);
    if (!review) return c.json({ error: 'Invalid review' }, 400);

    try {
        const site = await getCurrentSite(c);
        if (!site) return c.json({ error: 'Site not found' }, 404);
        const created = await createReview(site.id, review);
        return created ? c.json(created, 201) : c.json({ error: 'Invalid media' }, 400);
    } catch (error) {
        console.error('Failed to create site review', error);
        return c.json({ error: 'Internal server error' }, 500);
    }
}

export async function patchSiteReview(c) {
    const id = c.req.param('id');
    if (!isUuid(id)) return c.json({ error: 'Invalid UUID' }, 400);

    let body;
    try {
        body = await readJson(c);
    } catch (error) {
        return c.json({ error: error.message === 'BODY_TOO_LARGE' ? 'Request body too large' : 'Invalid review' }, error.message === 'BODY_TOO_LARGE' ? 413 : 400);
    }
    const changes = normalizeAdminReview(body, { partial: true });
    if (!changes) return c.json({ error: 'Invalid review' }, 400);

    try {
        const site = await getCurrentSite(c);
        if (!site) return c.json({ error: 'Site not found' }, 404);
        const review = await updateReview(site.id, id, changes);
        if (review === undefined) return c.json({ error: 'Invalid media' }, 400);
        return review ? c.json(review) : c.json({ error: 'Review not found' }, 404);
    } catch (error) {
        console.error('Failed to update review', error);
        return c.json({ error: 'Internal server error' }, 500);
    }
}

export async function deleteSiteReview(c) {
    const id = c.req.param('id');
    if (!isUuid(id)) return c.json({ error: 'Invalid UUID' }, 400);

    try {
        const site = await getCurrentSite(c);
        if (!site) return c.json({ error: 'Site not found' }, 404);
        return await deleteReview(site.id, id)
            ? c.body(null, 204)
            : c.json({ error: 'Review not found' }, 404);
    } catch (error) {
        console.error('Failed to delete review', error);
        return c.json({ error: 'Internal server error' }, 500);
    }
}
