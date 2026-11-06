import { pool } from "../../db/client.mjs";
import getHostname from "./getHostname.mjs";
import {
  isPlainObject,
  isValidPagePath,
  normalizePageTitle,
} from "../../shared/pageFields.mjs";
import findPageRouteConflict from "./pageRouteConflicts.mjs";
import { isPageDataSource } from "../../shared/pageDataSources.mjs";
import isUuid from "./isUuid.mjs";
import { pageFieldErrors, pageConflictFields } from './formErrors.mjs';

export default async function postPage(c) {
  let body;

  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid request" }, 400);
  }

  const keys = isPlainObject(body) ? Object.keys(body) : [];
  const title = normalizePageTitle(body?.title);
  const type = body?.type ?? "standard";
  const dataSource = body?.dataSource ?? null;
  const materialSectionId = body?.materialSectionId ?? null;

  if (
    keys.some((key) => !["title", "path", "type", "dataSource", "materialSectionId"].includes(key))
    || !keys.includes("title")
    || !keys.includes("path")
    || !title
    || !isValidPagePath(body.path)
    || !["standard", "list"].includes(type)
    || (type === "list" ? !isPageDataSource(dataSource) || (dataSource === "materials" ? !isUuid(materialSectionId) : materialSectionId !== null) : dataSource !== null || materialSectionId !== null)
  ) {
    return c.json({ error: "Проверьте поля страницы", fields: pageFieldErrors(body) }, 400);
  }

  const hostname = getHostname(c);

  if (!hostname) return c.json({ error: "Site not found" }, 404);

  let client;

  try {
    client = await pool.connect();
    await client.query("BEGIN");

    const { rows: sites } = await client.query(
      `SELECT s.id
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
    const conflict = await findPageRouteConflict(client, siteId, body.path);

    if (conflict) {
      await client.query("ROLLBACK");
      return c.json({ error: "Такой адрес уже используется", fields: pageConflictFields() }, 409);
    }

    const { rows } = await client.query(
      `INSERT INTO pages (site_id, title, path, content, page_type, data_source, material_section_id)
       VALUES ($1, $2, $3, '[]'::jsonb, $4, $5, $6)
       RETURNING id, site_id, path, title, content, page_type AS type, data_source AS "dataSource", material_section_id AS "materialSectionId"`,
      [siteId, title, body.path, type, dataSource, materialSectionId],
    );

    await client.query("COMMIT");

    return c.json(rows[0], 201);
  } catch (error) {
    await client?.query("ROLLBACK").catch(() => {});

    if (error.code === "23505") {
      return c.json({ error: 'Проверьте адрес и раздел', fields: pageConflictFields(error) }, 409);
    }

    console.error("Failed to create page", error);
    return c.json({ error: "Internal server error" }, 500);
  } finally {
    client?.release();
  }
}
