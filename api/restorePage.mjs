import { pool } from "../db/client.mjs";
import getHostname from "./getHostname.mjs";
import isUuid from "./isUuid.mjs";
import findPageRouteConflict from "./pageRouteConflicts.mjs";

export default async function restorePage(c) {
  const pageId = c.req.param("pageId");

  if (!isUuid(pageId)) {
    return c.json({ error: "Invalid UUID" }, 400);
  }

  const hostname = getHostname(c);

  if (!hostname) return c.json({ error: "Page not found" }, 404);

  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const { rows: pages } = await client.query(
      `SELECT p.* FROM pages p JOIN domains d ON d.site_id = p.site_id
       WHERE p.id = $1 AND p.deleted_at IS NOT NULL AND d.hostname = $2 FOR UPDATE OF p`,
      [pageId, hostname]);
    const page = pages[0];
    if (!page) { await client.query("ROLLBACK"); return c.json({ error: "Page not found" }, 404); }
    if (page.page_type === 'detail') {
      const { rows: parents } = await client.query(
        `SELECT id FROM pages WHERE id = $1 AND site_id = $2 AND page_type = 'list' AND deleted_at IS NULL`,
        [page.detail_parent_id, page.site_id]);
      if (!parents.length) { await client.query("ROLLBACK"); return c.json({ error: "Parent list page not found" }, 409); }
    }
    const conflict = await findPageRouteConflict(client, page.site_id, page.path, { excludePageIds: [pageId] });
    if (conflict) { await client.query("ROLLBACK"); return c.json({ error: "Page already exists" }, 409); }
    const { rows } = await client.query(
      `UPDATE pages SET deleted_at = NULL WHERE id = $1
       RETURNING id, site_id, path, title, content, page_type AS type,
                 data_source AS "dataSource", detail_parent_id AS "detailParentId",
                 route_param AS "routeParam"`, [pageId]);
    await client.query("COMMIT");
    return rows[0];
  } catch (error) {
    await client?.query("ROLLBACK").catch(() => {});
    console.error("Failed to restore page", error);
    return c.json({ error: "Internal server error" }, 500);
  } finally { client?.release(); }
}
