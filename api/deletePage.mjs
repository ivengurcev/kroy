import { pool } from "../db/client.mjs";
import getHostname from "./getHostname.mjs";
import isUuid from "./isUuid.mjs";

export default async function deletePage(c) {
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
    const { rows } = await client.query(
      `SELECT p.id, p.path, p.page_type,
              EXISTS (SELECT 1 FROM pages child WHERE child.detail_parent_id = p.id
                      AND child.page_type = 'detail' AND child.deleted_at IS NULL) AS has_template
       FROM pages p JOIN domains d ON d.site_id = p.site_id
       WHERE p.id = $1 AND p.deleted_at IS NULL AND d.hostname = $2
       FOR UPDATE OF p`, [pageId, hostname]);
    const page = rows[0];
    if (!page) { await client.query("ROLLBACK"); return c.json({ error: "Page not found" }, 404); }
    if (page.path === '/') { await client.query("ROLLBACK"); return c.json({ error: "Main page cannot be deleted" }, 409); }
    if (page.page_type === 'list' && page.has_template) { await client.query("ROLLBACK"); return c.json({ error: "Delete the detail template first" }, 409); }
    await client.query("UPDATE pages SET deleted_at = NOW() WHERE id = $1", [pageId]);
    await client.query("COMMIT");
    return c.body(null, 204);
  } catch (error) {
    await client?.query("ROLLBACK").catch(() => {});
    console.error("Failed to delete page", error);
    return c.json({ error: "Internal server error" }, 500);
  } finally { client?.release(); }
}
