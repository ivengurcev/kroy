import { isIP } from 'node:net';
import { createReview, getReviews, moderateReview } from '../db/reviews.mjs';
import getCurrentSite from './siteContext.mjs';
import isUuid from './isUuid.mjs';

const MAX_BODY_SIZE = 16 * 1024;
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const MAX_RATE_LIMIT_KEYS = 10000;
const PUBLIC_FIELDS = new Set(['authorName', 'authorSubtitle', 'text', 'mediaId', 'website']);
const REVIEW_STATUSES = new Set(['pending', 'published', 'rejected']);
const MODERATION_STATUSES = new Set(['published', 'rejected']);
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

function clientIp(c) {
    const realIp = c.req.header('X-Real-IP')?.trim();
    if (isIP(realIp)) return realIp;
    const forwarded = c.req.header('X-Forwarded-For');
    const forwardedIp = forwarded?.split(',').at(-1).trim();
    if (isIP(forwardedIp)) return forwardedIp;
    const remoteIp = c.env?.incoming?.socket?.remoteAddress;
    return isIP(remoteIp) ? remoteIp : 'unknown';
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
    let body;
    try {
        body = await readJson(c);
    } catch (error) {
        return c.json({ error: error.message === 'BODY_TOO_LARGE' ? 'Request body too large' : 'Invalid review' }, error.message === 'BODY_TOO_LARGE' ? 413 : 400);
    }

    try {
        const site = await getCurrentSite(c);
        if (!site) return c.json({ error: 'Site not found' }, 404);
        const wait = retryAfter(`${site.id}:${clientIp(c)}`);
        if (wait) return c.json({ error: 'Too many requests' }, 429, { 'Retry-After': String(wait) });
        if (typeof body?.website === 'string' && body.website.trim()) return c.json({ status: 'pending' }, 201);

        const review = normalizePublicReview(body);
        if (!review) return c.json({ error: 'Invalid review' }, 400);
        if (!(await createReview(site.id, review))) return c.json({ error: 'Invalid media' }, 400);
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

export async function patchSiteReview(c) {
    const id = c.req.param('id');
    if (!isUuid(id)) return c.json({ error: 'Invalid UUID' }, 400);

    let body;
    try {
        body = await readJson(c);
    } catch (error) {
        return c.json({ error: error.message === 'BODY_TOO_LARGE' ? 'Request body too large' : 'Invalid review' }, error.message === 'BODY_TOO_LARGE' ? 413 : 400);
    }
    if (!isPlainObject(body) || Object.keys(body).length !== 1 || !MODERATION_STATUSES.has(body.status)) {
        return c.json({ error: 'Invalid status' }, 400);
    }

    try {
        const site = await getCurrentSite(c);
        if (!site) return c.json({ error: 'Site not found' }, 404);
        const review = await moderateReview(site.id, id, body.status);
        return review ? c.json(review) : c.json({ error: 'Review not found' }, 404);
    } catch (error) {
        console.error('Failed to moderate review', error);
        return c.json({ error: 'Internal server error' }, 500);
    }
}
