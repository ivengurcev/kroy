import { pool } from '../../db/client.mjs';
import { getSiteTheme } from '../../db/siteThemes.mjs';
import { getThemeTokens } from '../../site/themes/themeRegistry.mjs';
import getCurrentSite from './siteContext.mjs';
import { getSiteContacts } from '../../db/siteContacts.mjs';
import { getCatalog } from '../../db/catalog.mjs';
import { getPublishedReviews } from '../../db/reviews.mjs';
import { getMaterialSections } from '../../db/materialSections.mjs';
import { attachMaterialLists } from '../../site/runtime/materialListData.mjs';

export default async function getSitePreview(c) {
    try {
        const site = await getCurrentSite(c);
        if (!site) return c.json({ error: 'Site not found' }, 404);
        const { rows } = await pool.query(
            `SELECT s.id AS site_id, p.id, p.path, p.title, p.content,
                    p.page_type AS type, p.data_source AS "dataSource", p.material_section_id AS "materialSectionId"
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
            `SELECT detail.path, detail.route_param AS "routeParam", detail.detail_parent_id AS "detailParentId",
                    list.material_section_id AS "materialSectionId"
             FROM pages detail
             JOIN pages list ON list.id = detail.detail_parent_id AND list.site_id = detail.site_id
             WHERE detail.site_id = $1 AND detail.page_type = 'detail'
               AND detail.deleted_at IS NULL AND list.deleted_at IS NULL`,
            [site.id],
        );
        const [materialSections, materialRows] = await Promise.all([
            getMaterialSections(site.id),
            pool.query(
                `SELECT section_id, slug, title, summary, status, cover_media_id AS "coverMediaId"
                 FROM materials WHERE site_id = $1 AND status = 'published' ORDER BY section_id, slug`,
                [site.id],
            ).then(({ rows: materialRows }) => materialRows),
        ]);
        const materialsBySection = Object.fromEntries(materialSections.map((section) => [section.id,
            materialRows.filter(({ section_id: sectionId }) => sectionId === section.id).map((material) => ({
                slug: material.slug, title: material.title, summary: material.summary, status: material.status,
                coverUrl: material.coverMediaId ? `/api/media/${material.coverMediaId}` : null,
            })),
        ]));
        const pages = Object.fromEntries(attachMaterialLists(
            rows.filter(({ path }) => path !== null), materialsBySection, detailTemplates,
        ).map(({ path, title, content, materials, materialSectionId }) => [path, {
            path, title, content, materials, materialSectionId,
        }]));

        return c.json({
            pages,
            detailTemplates,
            materialSections,
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
