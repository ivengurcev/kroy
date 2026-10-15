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

  try {
    const { rows } = await pool.query(
      `WITH target AS (
         SELECT p.path
         FROM pages p
         JOIN domains d ON d.site_id = p.site_id
         WHERE p.id = $1
           AND p.deleted_at IS NULL
           AND d.hostname = $2
       ), deleted AS (
         UPDATE pages p
         SET deleted_at = NOW()
         FROM domains d
         WHERE p.id = $1
           AND p.site_id = d.site_id
           AND p.deleted_at IS NULL
           AND p.path <> '/'
           AND d.hostname = $2
         RETURNING p.id
       )
       SELECT false AS main_page
       FROM deleted
       UNION ALL
       SELECT true
       FROM target
       WHERE path = '/'`,
      [pageId, hostname],
    );

    if (rows.length === 0) {
      return c.json({ error: "Page not found" }, 404);
    }

    if (rows[0].main_page) {
      return c.json({ error: "Main page cannot be deleted" }, 409);
    }

    return c.body(null, 204);
  } catch (error) {
    console.error("Failed to delete page", error);
    return c.json({ error: "Internal server error" }, 500);
  }
}
