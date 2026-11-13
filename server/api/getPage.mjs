import { pool } from "../../db/client.mjs";
import getHostname from "./getHostname.mjs";
import isUuid from "./isUuid.mjs";

export default async function getPage(c) {
  const pageId = c.req.param("pageId");
  const path = c.req.query("path");
  const deleted = c.req.query("deleted");
  const hostname = getHostname(c);

  if (!hostname) return c.json({ error: "Page not found" }, 404);

  if (pageId === undefined && deleted !== undefined && (!["1", "all"].includes(deleted) || path !== undefined)) {
    return c.json({ error: "Invalid request" }, 400);
  }

  if (pageId === undefined && path === undefined) {
    try {
      const deletedPages = deleted === "1";
      const { rows } = await pool.query(
        deletedPages
          ? `SELECT p.id, p.path, p.title, p.deleted_at,
                    p.page_type AS type, p.data_source AS "dataSource", p.material_section_id AS "materialSectionId",
                    p.detail_parent_id AS "detailParentId", p.route_param AS "routeParam"
             FROM domains d
             LEFT JOIN pages p ON p.site_id = d.site_id
              AND p.deleted_at IS NOT NULL
             WHERE d.hostname = $1
             ORDER BY p.deleted_at DESC, p.id`
          : `SELECT p.id, p.path, p.title, p.seo, p.deleted_at, p.page_type AS type,
                     p.data_source AS "dataSource", p.material_section_id AS "materialSectionId",
                    p.detail_parent_id AS "detailParentId", p.route_param AS "routeParam",
                    detail.id AS "detailTemplateId", detail.path AS "detailTemplatePath",
                     detail.deleted_at AS "detailTemplateDeletedAt",
                     ARRAY(SELECT r.from_path FROM redirects r
                           WHERE r.site_id = p.site_id AND r.page_id = p.id
                             AND p.deleted_at IS NULL AND p.page_type <> 'detail'
                             AND r.from_path <> p.path
                             AND NOT EXISTS (SELECT 1 FROM pages owner
                                 WHERE owner.site_id = p.site_id AND owner.path = r.from_path
                                   AND owner.deleted_at IS NULL)
                           ORDER BY r.from_path) AS redirects
             FROM domains d
             LEFT JOIN pages p ON p.site_id = d.site_id
               AND (p.deleted_at IS NULL OR $2::boolean)
             LEFT JOIN pages detail ON detail.site_id = p.site_id
              AND detail.detail_parent_id = p.id AND detail.page_type = 'detail'
             WHERE d.hostname = $1
             ORDER BY p.path, p.id`,
        deletedPages ? [hostname] : [hostname, deleted === "all"],
      );

      if (rows.length === 0) {
        return c.json({ error: "Site not found" }, 404);
      }

      return rows.filter(({ id }) => id !== null);
    } catch (error) {
      console.error("Failed to list pages", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  }

  let condition;
  let value;

  if (pageId !== undefined) {
    if (!isUuid(pageId)) {
      return c.json({ error: "Invalid UUID" }, 400);
    }

    condition = "p.id = $1";
    value = pageId;
  } else {
    if (
      typeof path !== "string"
      || !path.startsWith("/")
      || path.includes("?")
      || path.includes("#")
    ) {
      return c.json({ error: "Invalid path" }, 400);
    }

    condition = "p.path = $1";
    value = path;
  }

  try {
    const { rows } = await pool.query(
       `SELECT p.id, p.site_id, p.path, p.title, p.content, p.seo,
              p.page_type AS type, p.data_source AS "dataSource", p.material_section_id AS "materialSectionId",
              p.detail_parent_id AS "detailParentId", p.route_param AS "routeParam"
       FROM pages p
       JOIN domains d ON d.site_id = p.site_id
       WHERE ${condition}
         AND p.deleted_at IS NULL
         AND d.hostname = $2`,
      [value, hostname],
    );

    if (rows.length === 0) {
      return c.json({ error: "Page not found" }, 404);
    }

    return rows[0];
  } catch (error) {
    console.error("Failed to get page", error);
    return c.json({ error: "Internal server error" }, 500);
  }
}
