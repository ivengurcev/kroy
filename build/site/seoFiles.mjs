import { isValidPagePath } from '../../shared/pageFields.mjs';

const escapeXml = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');

export function createSitemap(pages, { development = false } = {}) {
    const urls = [...new Set(pages.filter((page) => !page.deleted_at && !page.deletedAt
        && (!page.record?.status || page.record.status === 'published')
        && isValidPagePath(page.path) && page.meta?.canonical && (development || page.meta.robots === 'index, follow'))
        .map((page) => page.meta.canonical))];
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((url) => `<url><loc>${escapeXml(url)}</loc></url>`).join('')}</urlset>\n`;
}

export function createRobots(origin) {
    // Crawling remains allowed even for noindex sites: robots must read HTML noindex.
    return `User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\nDisallow: /auth/\nSitemap: ${origin}/sitemap.xml\n`;
}
