import { pool } from "../../db/client.mjs";
import getHostname from "./getHostname.mjs";
import {
  isPlainObject,
  isValidPagePath,
  normalizePageTitle,
} from "../../shared/pageFields.mjs";
import findPageRouteConflict, { releasePageRedirects } from "./pageRouteConflicts.mjs";
import { isPageDataSource } from "../../shared/pageDataSources.mjs";
import isUuid from "./isUuid.mjs";
import { pageFieldErrors, pageConflictFields } from './formErrors.mjs';
import reusePagePath from './reusePagePath.mjs';
import { isDocumentText, isLegalPagePath, legalDocumentBlock, LEGAL_CONTENT_ERROR } from '../../shared/legalDocuments.mjs';
import { legacyFooterDocuments, omitLegacyFooterDocument } from '../../shared/footerSettings.mjs';
import { repairDocumentText } from '../../shared/lexicalEditor.mjs';

export default async function postPage(c) {
  let body;

  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid request" }, 400);
  }

  if (isPlainObject(body) && Object.hasOwn(body, 'content')) body = { ...body, content: repairDocumentText(body.content) };
  const keys = isPlainObject(body) ? Object.keys(body) : [];
  const title = normalizePageTitle(body?.title);
  const type = body?.type ?? "standard";
  const dataSource = body?.dataSource ?? null;
  const materialSectionId = body?.materialSectionId ?? null;
  const isLegalDocument = body?.isLegalDocument === true;

  if (
    keys.some((key) => !["title", "path", "type", "dataSource", "materialSectionId", "isLegalDocument", "content"].includes(key))
    || !keys.includes("title")
    || !keys.includes("path")
    || !title
    || !isValidPagePath(body.path)
    || !["standard", "list"].includes(type)
    || (keys.includes("isLegalDocument") && typeof body.isLegalDocument !== "boolean")
    || (!isLegalDocument && keys.includes("content"))
    || (isLegalDocument && type !== "standard")
    || (type === "list" ? !isPageDataSource(dataSource) || (dataSource === "materials" ? !isUuid(materialSectionId) : materialSectionId !== null) : dataSource !== null || materialSectionId !== null)
  ) {
    return c.json({ error: "Проверьте поля страницы", fields: pageFieldErrors(body) }, 400);
  }
  if (isLegalDocument) {
    const fields = {};
    if (!isLegalPagePath(body.path)) fields.path = 'Этот адрес недоступен для правового документа.';
    if (!isDocumentText(body.content)) fields.content = LEGAL_CONTENT_ERROR;
    if (Object.keys(fields).length) return c.json({ error: 'Проверьте поля документа', fields }, 400);
  }
  const content = isLegalDocument ? [legalDocumentBlock(body.content)] : [];

  const hostname = getHostname(c);

  if (!hostname) return c.json({ error: "Site not found" }, 404);

  let client;

  try {
    client = await pool.connect();
    await client.query("BEGIN");

    const { rows: sites } = await client.query(
      `SELECT s.id, s.footer_settings
       FROM sites s
       JOIN domains d ON d.site_id = s.id
       WHERE d.hostname = $1
       FOR UPDATE OF s`,
      [hostname],
    );

    if (sites.length === 0) {
      await client.query("ROLLBACK");
      return c.json({ error: "Site not found" }, 404);
    }

    const siteId = sites[0].id;
    if (dataSource === "materials") {
      const { rowCount } = await client.query("SELECT 1 FROM material_sections WHERE id = $1 AND site_id = $2", [materialSectionId, siteId]);
      if (!rowCount) { await client.query("ROLLBACK"); return c.json({ error: "Выберите раздел", fields: { materialSectionId: 'Выберите доступный раздел' } }, 400); }
    }
    const conflict = await findPageRouteConflict(client, siteId, body.path, { reclaimRedirects: true });

    if (conflict) {
      await client.query("ROLLBACK");
      return c.json({ error: "Такой адрес уже используется", fields: pageConflictFields() }, 409);
    }

    await releasePageRedirects(client, siteId, body.path);
    const reusedId = await reusePagePath(client, siteId, body.path, { keepRecord: true });
    // A new ordinary page must not inherit legal links through a reused UUID.
    const oldFooter = sites[0].footer_settings;
    if (reusedId && !isLegalDocument && oldFooter?.documents) {
      const keys = legacyFooterDocuments(oldFooter.documents)
        .filter(({ pageId }) => pageId === reusedId).map(({ key }) => key).reverse();
      if (keys.length) {
        const documents = keys.reduce(omitLegacyFooterDocument, oldFooter.documents);
        await client.query('UPDATE sites SET footer_settings = $2::jsonb, footer_version = footer_version + 1 WHERE id = $1',
          [siteId, JSON.stringify({ ...oldFooter, documents })]);
      }
    }
    const { rows } = await client.query(
      reusedId
        ? `UPDATE pages SET title = $2, path = $3, content = $7::jsonb, seo = '{}'::jsonb, appearance = '{}'::jsonb,
             deleted_at = NULL, page_type = $4, data_source = $5, material_section_id = $6,
             detail_parent_id = NULL, route_param = NULL, template_mode = 'inherit', template_id = NULL, is_legal_document = $8
           WHERE id = $9 AND site_id = $1
           RETURNING id, site_id, path, title, content, appearance, page_type AS type, data_source AS "dataSource",
                     material_section_id AS "materialSectionId", is_legal_document AS "isLegalDocument", xmin::text AS "legalVersion"`
        : `INSERT INTO pages (site_id, title, path, content, page_type, data_source, material_section_id, is_legal_document)
       VALUES ($1, $2, $3, $7::jsonb, $4, $5, $6, $8)
       RETURNING id, site_id, path, title, content, appearance, page_type AS type, data_source AS "dataSource",
                 material_section_id AS "materialSectionId", is_legal_document AS "isLegalDocument", xmin::text AS "legalVersion"`,
      [siteId, title, body.path, type, dataSource, materialSectionId, JSON.stringify(content), isLegalDocument, ...(reusedId ? [reusedId] : [])],
    );

    await client.query("COMMIT");

    return c.json(rows[0], 201);
  } catch (error) {
    await client?.query("ROLLBACK").catch(() => {});

    if (error.code === "23505" || error.code === 'PAGE_PATH_CONFLICT') {
      return c.json({ error: 'Проверьте адрес и раздел', fields: pageConflictFields(error) }, 409);
    }

    console.error("Failed to create page", error);
    return c.json({ error: "Internal server error" }, 500);
  } finally {
    client?.release();
  }
}
