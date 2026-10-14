import partCatalog from "../dist/kroy/parts.json" with { type: "json" };
import { pool } from "../db/client.mjs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isValidContent(content) {
  return Array.isArray(content) && content.every((item) => {
    if (!isPlainObject(item)) return false;

    const keys = Object.keys(item);

    return keys.length === 2
      && keys.includes("part")
      && keys.includes("props")
      && typeof item.part === "string"
      && item.part.trim().length > 0
      && Object.hasOwn(partCatalog, item.part)
      && isPlainObject(item.props);
  });
}

export default async function putPage(c) {
  const siteId = c.req.param("siteId");
  const pageId = c.req.param("pageId");

  if (!UUID_PATTERN.test(siteId) || !UUID_PATTERN.test(pageId)) {
    return c.json({ error: "Invalid UUID" }, 400);
  }

  let body;

  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid request" }, 400);
  }

  if (!isPlainObject(body) || !isValidContent(body.content)) {
    return c.json({ error: "Invalid content" }, 400);
  }

  try {
    const { rows } = await pool.query(
      `UPDATE pages
       SET content = $1
       WHERE id = $2 AND site_id = $3
       RETURNING id, site_id, path, title, content`,
      [JSON.stringify(body.content), pageId, siteId],
    );

    if (rows.length === 0) {
      return c.json({ error: "Page not found" }, 404);
    }

    return rows[0];
  } catch (error) {
    console.error("Failed to update page", error);
    return c.json({ error: "Internal server error" }, 500);
  }
}
