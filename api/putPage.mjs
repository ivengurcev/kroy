import partCatalog from "../dist/kroy/parts.json" with { type: "json" };
import { pool } from "../db/client.mjs";
import getHostname from "./getHostname.mjs";
import isUuid from "./isUuid.mjs";

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
  const pageId = c.req.param("pageId");

  if (!isUuid(pageId)) {
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

  const hostname = getHostname(c);

  if (!hostname) return c.json({ error: "Page not found" }, 404);

  try {
    const { rows } = await pool.query(
      `UPDATE pages p
       SET content = $1
       FROM domains d
       WHERE p.id = $2
         AND p.site_id = d.site_id
         AND p.deleted_at IS NULL
         AND d.hostname = $3
       RETURNING p.id, p.site_id, p.path, p.title, p.content`,
      [JSON.stringify(body.content), pageId, hostname],
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
