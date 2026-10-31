import { pool } from '../db/client.mjs';
import { getSiteTheme } from '../db/siteThemes.mjs';
import { getThemeTokens } from '../themes/themeRegistry.mjs';
import getCurrentSite from './siteContext.mjs';
import { getSiteContacts } from '../db/siteContacts.mjs';
import { getCatalog } from '../db/catalog.mjs';
import { getPublishedReviews } from '../db/reviews.mjs';
import { attachArticleLists } from '../layout/articleListData.mjs';

export default async function getSitePreview(c) {
    try {
        const site = await getCurrentSite(c);
        if (!site) return c.json({ error: 'Site not found' }, 404);
        const { rows } = await pool.query(
            `SELECT s.id AS site_id, p.id, p.path, p.title, p.content,
                    p.page_type AS type, p.data_source AS "dataSource"
             FROM sites s
             JOIN domains d ON d.site_id = s.id
             LEFT JOIN pages p ON p.site_id = s.id
              AND p.deleted_at IS NULL AND p.page_type <> 'detail'
             WHERE s.id = $1
             ORDER BY p.path`,
            [site.id],
        );

        if (rows.length === 0) return c.json({ error: 'Site not found' }, 404);

        const settings = await getSiteTheme(site.id);
        if (!settings) return c.json({ error: 'Site not found' }, 404);

        const { rows: detailTemplates } = await pool.query(
            `SELECT detail.path, detail.route_param AS "routeParam", detail.detail_parent_id AS "detailParentId"
             FROM pages detail
             JOIN pages list ON list.id = detail.detail_parent_id AND list.site_id = detail.site_id
             WHERE detail.site_id = $1 AND detail.page_type = 'detail'
               AND detail.deleted_at IS NULL AND list.deleted_at IS NULL`,
            [site.id],
        );
        const articles = rows.some((page) => page.type === 'list' && page.dataSource === 'articles')
            ? (await pool.query(
                `SELECT slug, title, summary, status, cover_media_id AS "coverMediaId"
                 FROM articles WHERE site_id = $1 AND status = 'published' ORDER BY slug`,
                [site.id],
            )).rows.map((article) => ({ ...article, coverUrl: article.coverMediaId ? `/api/media/${article.coverMediaId}` : null }))
            : [];
        const pages = Object.fromEntries(attachArticleLists(
            rows.filter(({ path }) => path !== null), articles, detailTemplates,
        ).map(({ path, title, content, articles: listArticles }) => [path, {
            path, title, content, ...(listArticles ? { articles: listArticles } : {}),
        }]));

        return c.json({
            pages,
            detailTemplates,
            theme: {
                mode: settings.themeMode,
                light: getThemeTokens(settings.themeId, 'light', settings.overrides),
                dark: getThemeTokens(settings.themeId, 'dark', settings.overrides),
            },
            contacts: await getSiteContacts(site.id),
            catalog: await getCatalog(site.id, { includeHidden: false }),
            reviews: await getPublishedReviews(site.id),
        });
    } catch (error) {
        console.error('Failed to load site preview', error);
        return c.json({ error: 'Internal server error' }, 500);
    }
}
