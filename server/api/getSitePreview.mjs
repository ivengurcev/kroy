import { pool } from '../../db/client.mjs';
import { getSiteTheme } from '../../db/siteThemes.mjs';
import { getPageTheme } from '../../site/themes/themeRegistry.mjs';
import getCurrentSite from './siteContext.mjs';
import { getSiteContacts } from '../../db/siteContacts.mjs';
import { getCatalog } from '../../db/catalog.mjs';
import { getPublishedReviews } from '../../db/reviews.mjs';
import { getMaterialSections } from '../../db/materialSections.mjs';
import { attachMaterialLists } from '../../site/runtime/materialListData.mjs';
import { listPageTemplates } from '../../db/pageTemplates.mjs';
import { prepareSiteFooter } from '../../shared/footerSettings.mjs';
import { projectPageLayouts } from '../../shared/pageTemplates.mjs';

export default async function getSitePreview(c) {
    let client;
    try {
        const site = await getCurrentSite(c);
        if (!site) return c.json({ error: 'Site not found' }, 404);
        client = await pool.connect();
        await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
        const { rows } = await client.query(
            `SELECT s.id AS site_id, s.name AS site_name, s.default_template_id, s.footer_settings,
                    p.id, p.path, p.title, p.content, p.appearance, p.is_legal_document AS "isLegalDocument",
                    p.template_mode AS "templateMode", p.template_id AS "templateId",
                    p.page_type AS type, p.data_source AS "dataSource", p.material_section_id AS "materialSectionId"
             FROM sites s
             LEFT JOIN pages p ON p.site_id = s.id
              AND p.deleted_at IS NULL AND p.page_type <> 'detail'
             WHERE s.id = $1
             ORDER BY p.path`,
            [site.id],
        );

        if (rows.length === 0) {
            await client.query('ROLLBACK');
            return c.json({ error: 'Site not found' }, 404);
        }

        const layouts = await listPageTemplates(client, site.id);
        const { rows: domains } = await client.query('SELECT hostname FROM domains WHERE site_id = $1', [site.id]);
        const linkPages = rows.filter(({ path }) => path !== null);
        const projected = projectPageLayouts(linkPages, rows[0].default_template_id, layouts, linkPages);
        const footer = prepareSiteFooter({ ...site, name: rows[0].site_name, domains: domains.map(({ hostname }) => hostname) },
            rows[0].footer_settings, linkPages);
        const settings = await getSiteTheme(site.id, client);

        const separator = settings.separatorMediaId
            ? (await client.query('SELECT mime_type FROM media WHERE id = $1 AND site_id = $2', [settings.separatorMediaId, site.id])).rows[0]
            : null;

        const { rows: detailTemplates } = await client.query(
            `SELECT detail.id, detail.path, detail.appearance, detail.route_param AS "routeParam", detail.detail_parent_id AS "detailParentId",
                    list.material_section_id AS "materialSectionId"
             FROM pages detail
             JOIN pages list ON list.id = detail.detail_parent_id AND list.site_id = detail.site_id
             WHERE detail.site_id = $1 AND detail.page_type = 'detail'
               AND detail.deleted_at IS NULL AND list.deleted_at IS NULL`,
            [site.id],
        );
        const materialSections = await getMaterialSections(site.id, client);
        const { rows: materialRows } = await client.query(
            `SELECT section_id, slug, title, summary, status, cover_media_id AS "coverMediaId"
             FROM materials WHERE site_id = $1 AND status = 'published' ORDER BY section_id, slug`,
            [site.id],
        );
        const contacts = await getSiteContacts(site.id, client);
        const catalog = await getCatalog(site.id, { includeHidden: false }, client);
        const reviews = await getPublishedReviews(site.id, client);
        await client.query('COMMIT');
        const materialsBySection = Object.fromEntries(materialSections.map((section) => [section.id,
            materialRows.filter(({ section_id: sectionId }) => sectionId === section.id).map((material) => ({
                slug: material.slug, title: material.title, summary: material.summary, status: material.status,
                coverUrl: material.coverMediaId ? `/api/media/${material.coverMediaId}` : null,
            })),
        ]));
        const pages = Object.fromEntries(attachMaterialLists(
            projected.pages, materialsBySection, detailTemplates,
        ).map(({ path, title, content, materials, materialSectionId, templateIndex, appearance = {} }) => [path, {
            path, title, content, materials, materialSectionId,
            ...(templateIndex !== undefined ? { templateIndex } : {}),
            ...(Object.keys(appearance).length ? { theme: getPageTheme(settings, appearance) } : {}),
        }]));

        return c.json({
            pages,
            templates: projected.templates,
            detailTemplates: detailTemplates.map(({ appearance = {}, ...template }) => ({
                ...template, ...(Object.keys(appearance).length ? { theme: getPageTheme(settings, appearance) } : {}),
            })),
            materialSections,
            theme: {
                ...getPageTheme(settings),
                separatorUrl: settings.separatorMediaId ? `/api/media/${settings.separatorMediaId}` : '',
                separatorMimeType: separator?.mime_type ?? null,
            },
            contacts,
            footer,
            catalog,
            reviews,
        });
    } catch (error) {
        await client?.query('ROLLBACK').catch(() => {});
        console.error('Failed to load site preview', error);
        return c.json({ error: 'Internal server error' }, 500);
    } finally {
        client?.release();
    }
}
