import { pool } from "../db/client.mjs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function getPage(c) {
  const siteId = c.req.param("siteId");
  const pageId = c.req.param("pageId");

  if (!UUID_PATTERN.test(siteId) || !UUID_PATTERN.test(pageId)) {
    return c.json({ error: "Invalid UUID" }, 400);
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, site_id, path, title, content
       FROM pages
       WHERE id = $1 AND site_id = $2`,
      [pageId, siteId],
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
