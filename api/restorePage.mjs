import { pool } from "../db/client.mjs";
import getHostname from "./getHostname.mjs";
import isUuid from "./isUuid.mjs";

export default async function restorePage(c) {
  const pageId = c.req.param("pageId");

  if (!isUuid(pageId)) {
    return c.json({ error: "Invalid UUID" }, 400);
  }

  const hostname = getHostname(c);

  if (!hostname) return c.json({ error: "Page not found" }, 404);

  try {
    const { rows } = await pool.query(
      `UPDATE pages p
       SET deleted_at = NULL
       FROM domains d
       WHERE p.id = $1
         AND p.site_id = d.site_id
         AND p.deleted_at IS NOT NULL
         AND d.hostname = $2
       RETURNING p.id, p.site_id, p.path, p.title, p.content`,
      [pageId, hostname],
    );

    if (rows.length === 0) {
      return c.json({ error: "Page not found" }, 404);
    }

    return rows[0];
  } catch (error) {
    console.error("Failed to restore page", error);
    return c.json({ error: "Internal server error" }, 500);
  }
}
