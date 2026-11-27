import { pool } from "../../db/client.mjs";
import getHostname from "./getHostname.mjs";
import isUuid from "./isUuid.mjs";
import {
  createDetailPath,
  isPlainObject,
  isValidPagePath,
  isValidRouteParameter,
  normalizePageTitle,
} from "../../shared/pageFields.mjs";
import findPageRouteConflict, { releasePageRedirects } from "./pageRouteConflicts.mjs";
import reusePagePath from './reusePagePath.mjs';
import { isPageDataSource } from "../../shared/pageDataSources.mjs";
import { pageFieldErrors, pageConflictFields } from './formErrors.mjs';
import { normalizeSeo } from '../../shared/seo.mjs';
import { seoReferenceErrors } from './seoValidation.mjs';
import { normalizePageAppearance, getPageTheme } from '../../site/themes/themeRegistry.mjs';
import { isDocumentText, isLegalDocumentContent, isLegalPagePath, updateFirstDocumentText, LEGAL_CONTENT_ERROR } from '../../shared/legalDocuments.mjs';
import { repairDocumentBlocks, repairDocumentText } from '../../shared/lexicalEditor.mjs';

export default async function patchPage(c) {
  const pageId = c.req.param("pageId");

  if (!isUuid(pageId)) return c.json({ error: "Invalid UUID" }, 400);

  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid request" }, 400);
  }

  const keys = isPlainObject(body) ? Object.keys(body) : [];
  const hasTitle = Object.hasOwn(body ?? {}, "title");
  const hasSeo = Object.hasOwn(body ?? {}, 'seo');
  const hasAppearance = Object.hasOwn(body ?? {}, 'appearance');
  const seoInput = hasSeo ? normalizeSeo(body.seo) : null;
  if (seoInput && Object.keys(seoInput.fields).length) return c.json({ error: 'Проверьте SEO-настройки', fields: Object.fromEntries(Object.entries(seoInput.fields).map(([key, message]) => [`seo.${key}`, message])) }, 400);
  const hasPath = Object.hasOwn(body ?? {}, "path");
  const hasRouteParam = Object.hasOwn(body ?? {}, "routeParam");
  const hasDataSource = Object.hasOwn(body ?? {}, "dataSource");
  const hasMaterialSectionId = Object.hasOwn(body ?? {}, "materialSectionId");
  const hasContent = keys.includes('content');
  if (hasContent) body = { ...body, content: repairDocumentText(body.content) };
  const hasLegalFlag = keys.includes('isLegalDocument');
  const title = hasTitle ? normalizePageTitle(body.title) : null;

  if (
    !keys.some((key) => key !== 'expectedLegalVersion')
    || keys.some((key) => !["title", "path", "routeParam", "dataSource", "materialSectionId", "seo", "appearance", "content", "isLegalDocument", "expectedLegalVersion"].includes(key))
    || (hasLegalFlag && typeof body.isLegalDocument !== 'boolean')
    || (hasTitle && !title)
    || (hasRouteParam && !isValidRouteParameter(body.routeParam))
    || (hasDataSource && !isPageDataSource(body.dataSource))
    || (hasMaterialSectionId && body.materialSectionId !== null && !isUuid(body.materialSectionId))
  ) {
    return c.json({ error: "Проверьте поля страницы", fields: pageFieldErrors(body) }, 400);
  }
  if (hasContent && !isDocumentText(body.content)) {
    return c.json({ error: 'Проверьте содержимое документа', fields: { content: LEGAL_CONTENT_ERROR } }, 400);
  }

  const hostname = getHostname(c);
  if (!hostname) return c.json({ error: "Page not found" }, 404);

  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");

    const { rows: sites } = await client.query(
      `SELECT s.id, s.theme_id, s.theme_mode, s.theme_overrides
       FROM sites s
       JOIN domains d ON d.site_id = s.id
       WHERE d.hostname = $1
       FOR UPDATE OF s`,
      [hostname],
    );
    if (!sites.length) {
      await client.query("ROLLBACK");
      return c.json({ error: "Page not found" }, 404);
    }

    const siteId = sites[0].id;
    const { rows: pages } = await client.query(
      `SELECT id, site_id, path, title, content, seo, appearance, page_type, data_source, material_section_id,
              detail_parent_id, route_param, is_legal_document, xmin::text AS "legalVersion"
       FROM pages
       WHERE id = $1 AND site_id = $2 AND deleted_at IS NULL
       FOR UPDATE`,
      [pageId, siteId],
    );
    const page = pages[0];
    if (!page) {
      await client.query("ROLLBACK");
      return c.json({ error: "Page not found" }, 404);
    }
    const documentContent = repairDocumentBlocks(page.content);

    const nextLegal = hasLegalFlag ? body.isLegalDocument : page.is_legal_document;
    if ((page.is_legal_document || hasLegalFlag || keys.includes('expectedLegalVersion'))
        && body.expectedLegalVersion !== page.legalVersion) {
      await client.query("ROLLBACK");
      return c.json({ error: 'Страница изменилась. Откройте актуальную версию и перенесите правки.', code: 'legal_document_conflict' }, 409);
    }
    if ((hasLegalFlag && page.page_type !== 'standard')
        || (hasContent && !page.is_legal_document)
        || ((hasContent || nextLegal) && !isLegalDocumentContent(documentContent))) {
      await client.query("ROLLBACK");
      return c.json({ error: 'Проверьте содержимое документа', fields: { content: LEGAL_CONTENT_ERROR } }, 400);
    }

    if (
      page.page_type === "detail" && (hasPath || hasDataSource || hasMaterialSectionId || hasSeo)
      || page.page_type !== "detail" && hasRouteParam
      || page.page_type !== "list" && (hasDataSource || hasMaterialSectionId)
    ) {
      await client.query("ROLLBACK");
      return c.json({ error: "Invalid page" }, 400);
    }

    const nextTitle = hasTitle ? title : page.title;
    let nextAppearance = page.appearance ?? {};
    if (hasAppearance) {
      try {
        nextAppearance = normalizePageAppearance({
          themeId: sites[0].theme_id, themeMode: sites[0].theme_mode, overrides: sites[0].theme_overrides,
        }, body.appearance);
      } catch {
        await client.query('ROLLBACK');
        return c.json({ error: 'Проверьте оформление страницы', fields: { appearance: 'Некорректные настройки оформления' } }, 400);
      }
    }
    if (hasSeo) {
      const fields = await seoReferenceErrors(client, siteId, seoInput.seo);
      if (Object.keys(fields).length) {
        await client.query('ROLLBACK');
        return c.json({ error: 'Проверьте SEO-настройки', fields: Object.fromEntries(Object.entries(fields).map(([key, message]) => [`seo.${key}`, message])) }, 400);
      }
    }
    const nextRouteParam = hasRouteParam ? body.routeParam : page.route_param;
    const nextDataSource = hasDataSource ? body.dataSource : page.data_source;
    const nextMaterialSectionId = nextDataSource === "materials"
      ? hasMaterialSectionId ? body.materialSectionId : page.material_section_id
      : null;
    if (page.page_type === "list" && nextDataSource === "materials") {
      if (!nextMaterialSectionId) {
        await client.query("ROLLBACK");
        return c.json({ error: "Выберите раздел", fields: { materialSectionId: 'Выберите раздел' } }, 400);
      }
      const { rowCount } = await client.query(
        "SELECT 1 FROM material_sections WHERE id = $1 AND site_id = $2",
        [nextMaterialSectionId, siteId],
      );
      if (!rowCount) {
        await client.query("ROLLBACK");
        return c.json({ error: "Выберите раздел", fields: { materialSectionId: 'Выберите доступный раздел' } }, 400);
      }
    }
    let nextPath = page.path;
    let pathChanged = false;
    let detailTemplate;

    if (page.page_type === "detail") {
      const { rows: parents } = await client.query(
        `SELECT path, page_type
         FROM pages
         WHERE id = $1 AND site_id = $2 AND deleted_at IS NULL`,
        [page.detail_parent_id, siteId],
      );
      if (!parents.length || parents[0].page_type !== "list") {
        await client.query("ROLLBACK");
        return c.json({ error: "Parent list page not found" }, 409);
      }
      nextPath = createDetailPath(parents[0].path, nextRouteParam);
      pathChanged = nextPath !== page.path;
    } else if (hasPath) {
      if (!isValidPagePath(body.path)) {
        await client.query("ROLLBACK");
        return c.json({ error: "Проверьте путь страницы", fields: pageFieldErrors(body) }, 400);
      }
      pathChanged = body.path !== page.path;
      nextPath = body.path;
    }

    if (page.path === "/" && pathChanged) {
      await client.query("ROLLBACK");
      return c.json({ error: "Main page path cannot be changed", fields: { path: 'Путь главной страницы нельзя изменить.' } }, 400);
    }
    if (nextLegal && !isLegalPagePath(nextPath)) {
      await client.query("ROLLBACK");
      return c.json({ error: 'Проверьте путь страницы', fields: { path: 'Этот адрес недоступен для правового документа.' } }, 400);
    }

    if (page.page_type === "list" && pathChanged) {
      const { rows: templates } = await client.query(
        `SELECT id, path, route_param, deleted_at
         FROM pages
         WHERE site_id = $1 AND detail_parent_id = $2 AND page_type = 'detail'
         FOR UPDATE`,
        [siteId, pageId],
      );
      detailTemplate = templates[0];
    }

    const excluded = [pageId, detailTemplate?.id].filter(Boolean);
    if (pathChanged) {
      const conflict = await findPageRouteConflict(client, siteId, nextPath, {
        excludePageIds: excluded,
        reclaimRedirects: true,
        excludeRedirectPageIds: page.page_type === "detail" ? [] : [pageId],
      });
      if (conflict) {
        await client.query("ROLLBACK");
        return c.json({ error: "Такой адрес уже используется", fields: { [page.page_type === 'detail' ? 'routeParam' : 'path']: 'Такой адрес уже используется' } }, 409);
      }
    }

    const nextDetailPath = detailTemplate
      ? createDetailPath(nextPath, detailTemplate.route_param)
      : null;
    if (nextDetailPath && !detailTemplate.deleted_at && nextDetailPath !== detailTemplate.path) {
      const conflict = await findPageRouteConflict(client, siteId, nextDetailPath, {
        excludePageIds: excluded,
        reclaimRedirects: true,
      });
      if (conflict) {
        await client.query("ROLLBACK");
        return c.json({ error: "Такой адрес уже используется", fields: pageConflictFields() }, 409);
      }
    }

    if (pathChanged) {
      await releasePageRedirects(client, siteId, nextPath);
      await reusePagePath(client, siteId, nextPath, { excludePageIds: excluded });
    }
    if (nextDetailPath && !detailTemplate.deleted_at && nextDetailPath !== detailTemplate.path) {
      await releasePageRedirects(client, siteId, nextDetailPath);
    }
    if (nextDetailPath && nextDetailPath !== detailTemplate.path) {
      await reusePagePath(client, siteId, nextDetailPath, { excludePageIds: excluded });
    }
    if (page.page_type !== "detail" && pathChanged) {
      const { rows: redirects } = await client.query(
        `SELECT page_id FROM redirects WHERE site_id = $1 AND from_path = $2`,
        [siteId, nextPath],
      );
      if (redirects[0]?.page_id === pageId) {
        await client.query(
          `DELETE FROM redirects WHERE site_id = $1 AND from_path = $2 AND page_id = $3`,
          [siteId, nextPath, pageId],
        );
      }
    }

    const { rows } = await client.query(
      `UPDATE pages
       SET title = $2, path = $3, route_param = $4,
             data_source = $5, material_section_id = $6, seo = $7::jsonb, appearance = $8::jsonb,
             content = CASE WHEN $9::boolean THEN $10::jsonb ELSE content END,
             is_legal_document = $11::boolean
       WHERE id = $1
         RETURNING id, site_id, path, title, content, seo, appearance, page_type AS type,
                 data_source AS "dataSource", material_section_id AS "materialSectionId",
                 detail_parent_id AS "detailParentId", route_param AS "routeParam",
                 is_legal_document AS "isLegalDocument", xmin::text AS "legalVersion"`,
      [pageId, nextTitle, nextPath, page.page_type === "detail" ? nextRouteParam : null,
        page.page_type === "list" ? nextDataSource : null,
        page.page_type === "list" ? nextMaterialSectionId : null,
        JSON.stringify(hasSeo ? seoInput.seo : page.seo), JSON.stringify(nextAppearance), hasContent,
        hasContent ? JSON.stringify(updateFirstDocumentText(page.content, body.content)) : null, nextLegal],
    );

    if (detailTemplate && nextDetailPath !== detailTemplate.path) {
      await client.query(
        `UPDATE pages SET path = $2 WHERE id = $1`,
        [detailTemplate.id, nextDetailPath],
      );
    }

    if (pathChanged && page.page_type !== "detail") {
      await client.query(
        `INSERT INTO redirects (site_id, from_path, page_id)
         VALUES ($1, $2, $3)`,
        [siteId, page.path, pageId],
      );
    }

    if (page.page_type === "list") {
      const { rows: templates } = await client.query(
        `SELECT id, path, deleted_at AS "deletedAt"
         FROM pages
         WHERE site_id = $1 AND detail_parent_id = $2 AND page_type = 'detail'`,
        [siteId, pageId],
      );
      rows[0].detailTemplateId = templates[0]?.id ?? null;
      rows[0].detailTemplatePath = templates[0]?.path ?? null;
      rows[0].detailTemplateDeletedAt = templates[0]?.deletedAt ?? null;
    }

    await client.query("COMMIT");
    if (hasAppearance) rows[0].theme = getPageTheme({
      themeId: sites[0].theme_id, themeMode: sites[0].theme_mode, overrides: sites[0].theme_overrides,
    }, nextAppearance);
    return rows[0];
  } catch (error) {
    await client?.query("ROLLBACK").catch(() => {});
    if (error.code === "23505" || error.code === 'PAGE_PATH_CONFLICT') return c.json({ error: error.constraint === "pages_one_active_material_list_per_section" ? "A material list already exists for this section" : "Page already exists", fields: pageConflictFields(error) }, 409);
    console.error("Failed to update page details", error);
    return c.json({ error: "Internal server error" }, 500);
  } finally {
    client?.release();
  }
}
