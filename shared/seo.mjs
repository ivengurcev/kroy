import { isPlainObject, isValidPagePath } from './pageFields.mjs';

export const DEFAULT_TITLE_TEMPLATE = '{page} — {site}';
const text = (value) => typeof value === 'string' ? value.trim() : '';

export function isSeoDomain(value) {
    return typeof value === 'string' && value.length <= 253
        && /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]*$/.test(value)
        && !/(?:^|\.)(localhost|local|internal|lan|test|invalid|example|home|home\.arpa)$/.test(value);
}

// Empty optional values are omitted, never materialized from inherited values.
export function normalizeSeo(value, { site = false } = {}) {
    const fields = {};
    if (!isPlainObject(value)) return { fields: { seo: 'Некорректные SEO-настройки' } };
    const limits = site ? { name: 300, titleTemplate: 500, description: 2000, primaryDomain: 253 } : { title: 300, description: 2000 };
    const allowed = [...Object.keys(limits), 'imageId', site ? 'indexable' : 'indexing'];
    if (Object.keys(value).some((key) => !allowed.includes(key))) fields.seo = 'Неизвестные SEO-поля';
    const seo = {};
    for (const [key, limit] of Object.entries(limits)) {
        if (value[key] == null || value[key] === '') continue;
        if (typeof value[key] !== 'string' || value[key].length > limit) fields[key] = `Введите текст до ${limit} символов`;
        else if (value[key].trim()) seo[key] = value[key].trim();
    }
    if (seo.titleTemplate && (!seo.titleTemplate.includes('{page}') || /\{(?!page\}|site\})/.test(seo.titleTemplate))) fields.titleTemplate = 'Используйте {page} и необязательный {site}';
    if (seo.primaryDomain && !isSeoDomain(seo.primaryDomain)) fields.primaryDomain = 'Выберите публичный домен сайта';
    if (value.imageId != null && value.imageId !== '') {
        if (typeof value.imageId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.imageId)) fields.imageId = 'Выберите изображение сайта';
        else seo.imageId = value.imageId;
    }
    if (site) {
        if (value.indexable !== undefined && typeof value.indexable !== 'boolean') fields.indexable = 'Выберите режим индексации';
        else if (value.indexable !== undefined) seo.indexable = value.indexable;
    } else if (value.indexing != null && value.indexing !== 'inherit') {
        if (!['allow', 'deny'].includes(value.indexing)) fields.indexing = 'Выберите режим индексации';
        else seo.indexing = value.indexing;
    }
    return { seo, fields };
}

export function resolvePageMeta(site, page, record = page.record) {
    const settings = site.seo ?? {};
    const own = record ? {} : page.seo ?? {};
    const siteName = text(settings.name) || text(site.name);
    const template = text(settings.titleTemplate) || DEFAULT_TITLE_TEMPLATE;
    const title = record ? text(record.title || record.name) || `${text(record.authorName)} — Отзыв`
        : text(own.title) || template.replace(/\{(page|site)\}/g, (_, key) => key === 'page' ? text(page.title) : siteName);
    const description = text(record ? record.summary || record.description || record.text : own.description) || text(settings.description);
    const domain = settings.primaryDomain;
    const origin = isSeoDomain(domain) ? `https://${domain}` : null;
    const canonical = origin && isValidPagePath(page.path) && !/^\/(auth|assets|_kroy)(\/|$)/.test(page.path) ? `${origin}${page.path}` : null;
    const imagePath = (record ? record.coverUrl || record.mediaUrl : own.imageUrl) || settings.imageUrl;
    // Images are release-owned public assets, not API/admin or external URLs.
    const image = origin && typeof imagePath === 'string' && /^\/_kroy\/releases\/[^/]+\/assets\/[a-zA-Z0-9_./-]+$/.test(imagePath) && !imagePath.includes('..') ? `${origin}${imagePath}` : null;
    return {
        title,
        description: record?.text ? description.replace(/\s+/g, ' ').slice(0, 300) : description,
        canonical,
        robots: settings.indexable === false || own.indexing === 'deny' ? 'noindex, follow' : 'index, follow',
        image,
        type: record && page.dataSource === 'materials' ? 'article' : 'website',
        siteName,
    };
}

// Both the SSR head and SPA synchronizer consume this exact tag list.
export function metaTags(meta) {
    return [
        ['name', 'description', meta.description], ['name', 'robots', meta.robots],
        ['property', 'og:title', meta.title], ['property', 'og:description', meta.description],
        ['property', 'og:image', meta.image], ['property', 'og:url', meta.canonical],
        ['property', 'og:type', meta.type], ['property', 'og:site_name', meta.siteName],
        ['name', 'twitter:card', meta.image ? 'summary_large_image' : 'summary'],
        ['name', 'twitter:title', meta.title], ['name', 'twitter:description', meta.description],
        ['name', 'twitter:image', meta.image],
    ].filter(([, , value]) => Boolean(value));
}
