import { isPlainObject, isValidPagePath } from './pageFields.mjs';
import { normalizeHref } from './safeHref.mjs';

export const FOOTER_DOCUMENTS = {
    privacyPageId: 'Политика обработки персональных данных',
    offerPageId: 'Публичная оферта',
    paymentPageId: 'Условия оплаты и возврата',
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function normalizeFooterSettings(value) {
    const fields = {};
    const error = (path) => Object.defineProperty(fields, path || 'footer', {
        value: 'Проверьте значение поля', enumerable: true, configurable: true,
    });
    function object(source, allowed, path) {
        if (!isPlainObject(source)) { error(path); return {}; }
        for (const key of Object.keys(source)) if (!allowed.includes(key)) error(path ? `${path}.${key}` : key);
        return source;
    }
    function text(value, max, path) {
        if (value === undefined) return '';
        if (typeof value !== 'string' || value.length > max) { error(path); return ''; }
        return value.trim();
    }
    function pageId(value, path) {
        if (value === null || value === undefined || value === '') return null;
        if (typeof value !== 'string' || !uuid.test(value)) { error(path); return null; }
        return value.toLowerCase();
    }
    function list(value, path, additional = false) {
        if (value === undefined) return [];
        if (!Array.isArray(value) || value.length > 50) { error(path); return []; }
        return value.map((item, index) => {
            const key = `${path}.${index}`;
            const source = object(item, additional ? ['pageId', 'label', 'url'] : ['pageId'], key);
            if (additional && Object.hasOwn(source, 'url')) {
                const label = text(source.label, 200, `${key}.label`);
                const url = text(source.url, 2000, `${key}.url`);
                // Internal destinations must be page references, not stale paths.
                if (source.pageId !== undefined || !label || !/^https?:\/\//i.test(url) || !normalizeHref(url)) error(key);
                return { label, url };
            }
            const id = pageId(source.pageId, `${key}.pageId`);
            if (!id || source.label !== undefined) error(key);
            return { pageId: id };
        });
    }
    const source = object(value, ['description', 'navigation', 'documents', 'legal'], '');
    const documents = object(source.documents === undefined ? {} : source.documents, [...Object.keys(FOOTER_DOCUMENTS), 'additional'], 'documents');
    const legal = object(source.legal === undefined ? {} : source.legal, ['name', 'inn', 'registrationNumber'], 'legal');
    return {
        settings: {
            description: text(source.description, 1000, 'description'),
            navigation: list(source.navigation, 'navigation'),
            documents: {
                ...Object.fromEntries(Object.keys(FOOTER_DOCUMENTS).map((name) => [name, pageId(documents[name], `documents.${name}`)])),
                additional: list(documents.additional, 'documents.additional', true),
            },
            legal: {
                name: text(legal.name, 500, 'legal.name'),
                inn: text(legal.inn, 12, 'legal.inn'),
                registrationNumber: text(legal.registrationNumber, 15, 'legal.registrationNumber'),
            },
        },
        fields,
    };
}

export function footerPageIds(settings) {
    return [...new Set([
        ...settings.navigation.map(({ pageId }) => pageId),
        ...legacyFooterDocuments(settings.documents).map(({ pageId }) => pageId),
    ].filter(Boolean))];
}

export function legacyFooterDocuments(documents = {}) {
    const reference = (key, value, label) => typeof value === 'string' && value
        ? [{ key, label, pageId: value.toLowerCase() }] : [];
    return [
        ...Object.entries(FOOTER_DOCUMENTS).flatMap(([key, label]) => reference(key, documents[key], label)),
        ...(Array.isArray(documents.additional) ? documents.additional : []).flatMap((item, index) =>
            reference(index, item?.pageId)),
    ];
}

export function omitLegacyFooterDocument(documents, key) {
    if (typeof key === 'number') {
        return { ...documents, additional: documents.additional.filter((_, index) => index !== key) };
    }
    const next = { ...documents };
    delete next[key];
    return next;
}

export function availableFooterPages(pages, siteId) {
    return pages.filter((page) => (!siteId || page.site_id === siteId)
        && page.id && !page.deleted_at && !page.deletedAt
        && page.type !== 'detail' && page.page_type !== 'detail'
        && isValidPagePath(page.path)
        && !/^\/(?:auth|assets)(?:\/|$)/.test(page.path));
}

export function isSiteFooterUrl(url, domains = []) {
    try {
        const hostname = new URL(url).hostname.toLowerCase().replace(/\.$/, '');
        return domains.some((domain) => domain.toLowerCase().replace(/\.$/, '') === hostname);
    } catch { return false; }
}

export function prepareSiteFooter(site, value, pages, year = new Date().getFullYear()) {
    const normalized = normalizeFooterSettings(value ?? {});
    // Treat stored JSON as untrusted too; never expose unsupported configuration.
    const settings = Object.keys(normalized.fields).length ? normalizeFooterSettings({}).settings : normalized.settings;
    const byId = new Map(availableFooterPages(pages, site.id).map((page) => [page.id, page]));
    function link(id, label) {
        const page = byId.get(id);
        return page ? { label: label ?? page.title, href: page.path } : null;
    }
    const documents = [
        ...[...byId.values()].filter(({ isLegalDocument }) => isLegalDocument).map(({ id }) => link(id)),
        ...Object.entries(FOOTER_DOCUMENTS).map(([key, label]) => link(settings.documents[key], label)),
        ...settings.documents.additional.map(({ pageId, label, url }) => pageId
            ? link(pageId) : isSiteFooterUrl(url, site.domains) ? null : { label, href: url }),
    ];
    const destinations = new Set();
    return {
        siteName: site.name,
        year,
        description: settings.description,
        navigation: settings.navigation.map(({ pageId }) => link(pageId)).filter(Boolean),
        documents: documents.filter((document) => {
            if (!document) return false;
            const destination = document.href.startsWith('/') ? document.href : new URL(document.href).href;
            if (destinations.has(destination)) return false;
            destinations.add(destination);
            return true;
        }),
        legal: settings.legal,
    };
}

export function footerBlock(props) {
    return { part: '@kroy/footer', props, view: { name: '@kroy/footer', props: {} } };
}

export function projectHeader(block, pages) {
    if (block.part !== '@kroy/header') return block;
    return {
        ...block,
        props: {
            title: block.props.title,
            navigation: (Array.isArray(block.props.navigation) ? block.props.navigation : []).flatMap((link) => {
                const page = pages.find(({ id }) => id === link?.pageId?.toLowerCase?.());
                return page ? [{ href: page.path, label: page.title }] : [];
            }),
        },
    };
}
