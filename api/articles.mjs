import { createArticle, deleteArticle, getArticle, getArticles, hasSiteMedia, updateArticle } from '../db/articles.mjs';
import getCurrentSite from './siteContext.mjs';
import isUuid from './isUuid.mjs';

const ARTICLE_FIELDS = new Set(['slug', 'title', 'summary', 'content', 'coverMediaId', 'status']);
const ARTICLE_STATUSES = new Set(['draft', 'published']);
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeText(value, maxLength, { required = false } = {}) {
    if (typeof value !== 'string') return null;
    const text = value.trim();
    if (!text && required) return null;
    return text.length <= maxLength ? text : null;
}

function normalizeSlug(value) {
    if (typeof value !== 'string') return null;
    const slug = value.trim();
    return slug.length <= 200 && SLUG_PATTERN.test(slug) ? slug : null;
}

function normalizeContent(value) {
    return value === null || isPlainObject(value) ? value : undefined;
}

export function normalizeArticleInput(body, { partial = false } = {}) {
    if (!isPlainObject(body) || Object.keys(body).length === 0
        || Object.keys(body).some((key) => !ARTICLE_FIELDS.has(key))) return null;
    if (!partial && (!Object.hasOwn(body, 'slug') || !Object.hasOwn(body, 'title'))) return null;

    const article = {};
    if (Object.hasOwn(body, 'slug')) {
        article.slug = normalizeSlug(body.slug);
        if (!article.slug) return null;
    }
    if (Object.hasOwn(body, 'title')) {
        article.title = normalizeText(body.title, 300, { required: true });
        if (!article.title) return null;
    }
    if (Object.hasOwn(body, 'summary')) {
        article.summary = normalizeText(body.summary, 2000);
        if (article.summary === null) return null;
    }
    if (Object.hasOwn(body, 'content')) {
        article.content = normalizeContent(body.content);
        if (article.content === undefined) return null;
    }
    if (Object.hasOwn(body, 'coverMediaId')) {
        const mediaId = body.coverMediaId;
        article.coverMediaId = mediaId === null || mediaId === '' ? null : mediaId;
        if (article.coverMediaId !== null && !isUuid(article.coverMediaId)) return null;
    }
    if (Object.hasOwn(body, 'status')) {
        if (!ARTICLE_STATUSES.has(body.status)) return null;
        article.status = body.status;
    }

    if (!partial) {
        article.summary ??= '';
        article.content ??= null;
        article.coverMediaId ??= null;
        article.status ??= 'draft';
    }
    return article;
}

export function isPublishableArticle(article) {
    return article.status !== 'published' || article.content !== null;
}

async function readBody(c) {
    try {
        return await c.req.json();
    } catch {
        return undefined;
    }
}

function invalidArticle(c) {
    return c.json({ error: 'Invalid article' }, 400);
}

export async function getSiteArticles(c) {
    try {
        const site = await getCurrentSite(c);
        if (!site) return c.json({ error: 'Site not found' }, 404);
        return c.json(await getArticles(site.id));
    } catch (error) {
        console.error('Failed to get articles', error);
        return c.json({ error: 'Internal server error' }, 500);
    }
}

export async function getSiteArticle(c) {
    const id = c.req.param('id');
    if (!isUuid(id)) return c.json({ error: 'Invalid UUID' }, 400);

    try {
        const site = await getCurrentSite(c);
        if (!site) return c.json({ error: 'Site not found' }, 404);
        const article = await getArticle(site.id, id);
        return article ? c.json(article) : c.json({ error: 'Article not found' }, 404);
    } catch (error) {
        console.error('Failed to get article', error);
        return c.json({ error: 'Internal server error' }, 500);
    }
}

export async function postSiteArticle(c) {
    const body = await readBody(c);
    const article = normalizeArticleInput(body);
    if (!article || !isPublishableArticle(article)) return invalidArticle(c);

    try {
        const site = await getCurrentSite(c);
        if (!site) return c.json({ error: 'Site not found' }, 404);
        if (article.coverMediaId !== null && !(await hasSiteMedia(site.id, article.coverMediaId))) {
            return c.json({ error: 'Invalid cover media' }, 400);
        }
        const created = await createArticle(site.id, article);
        return created ? c.json(created, 201) : c.json({ error: 'Invalid cover media' }, 400);
    } catch (error) {
        if (error.code === '23505') return c.json({ error: 'Article slug already exists' }, 409);
        console.error('Failed to create article', error);
        return c.json({ error: 'Internal server error' }, 500);
    }
}

export async function patchSiteArticle(c) {
    const id = c.req.param('id');
    if (!isUuid(id)) return c.json({ error: 'Invalid UUID' }, 400);

    const body = await readBody(c);
    const changes = normalizeArticleInput(body, { partial: true });
    if (!changes) return invalidArticle(c);

    try {
        const site = await getCurrentSite(c);
        if (!site) return c.json({ error: 'Site not found' }, 404);
        const current = await getArticle(site.id, id);
        if (!current) return c.json({ error: 'Article not found' }, 404);

        const next = { ...current, ...changes };
        if (!isPublishableArticle(next)) return c.json({ error: 'Published article requires content' }, 400);
        if (changes.coverMediaId !== undefined
            && changes.coverMediaId !== null
            && !(await hasSiteMedia(site.id, changes.coverMediaId))) {
            return c.json({ error: 'Invalid cover media' }, 400);
        }

        const updated = await updateArticle(site.id, id, changes);
        return updated ? c.json(updated) : c.json({ error: 'Article not found' }, 404);
    } catch (error) {
        if (error.code === '23505') return c.json({ error: 'Article slug already exists' }, 409);
        console.error('Failed to update article', error);
        return c.json({ error: 'Internal server error' }, 500);
    }
}

export async function deleteSiteArticle(c) {
    const id = c.req.param('id');
    if (!isUuid(id)) return c.json({ error: 'Invalid UUID' }, 400);

    try {
        const site = await getCurrentSite(c);
        if (!site) return c.json({ error: 'Site not found' }, 404);
        return await deleteArticle(site.id, id)
            ? c.body(null, 204)
            : c.json({ error: 'Article not found' }, 404);
    } catch (error) {
        console.error('Failed to delete article', error);
        return c.json({ error: 'Internal server error' }, 500);
    }
}
