import { pool } from "../db/client.mjs";
import getHostname from "./getHostname.mjs";
import isUuid from "./isUuid.mjs";
import {
  isPlainObject,
  isValidPagePath,
  normalizePageTitle,
} from "./pageFields.mjs";

export default async function patchPage(c) {
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

  const keys = isPlainObject(body) ? Object.keys(body) : [];
  const hasTitle = Object.hasOwn(body ?? {}, "title");
  const hasPath = Object.hasOwn(body ?? {}, "path");
  const title = hasTitle ? normalizePageTitle(body.title) : null;

  if (
    keys.length === 0
    || keys.length > 2
    || keys.some((key) => key !== "title" && key !== "path")
    || (hasTitle && !title)
    || (hasPath && !isValidPagePath(body.path))
  ) {
    return c.json({ error: "Invalid page" }, 400);
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
       ), updated AS (
         UPDATE pages p
         SET title = CASE WHEN $3::boolean THEN $4 ELSE p.title END,
             path = CASE WHEN $5::boolean THEN $6 ELSE p.path END
         FROM domains d
         WHERE p.id = $1
           AND p.site_id = d.site_id
           AND p.deleted_at IS NULL
           AND d.hostname = $2
           AND NOT (p.path = '/' AND $5::boolean AND $6 <> '/')
         RETURNING p.id, p.site_id, p.path, p.title, p.content
       )
       SELECT id, site_id, path, title, content, false AS path_blocked
       FROM updated
       UNION ALL
       SELECT NULL::uuid, NULL::uuid, NULL::text, NULL::text, NULL::jsonb, true
       FROM target
       WHERE path = '/'
         AND $5::boolean
         AND $6 <> '/'`,
      [pageId, hostname, hasTitle, title, hasPath, hasPath ? body.path : null],
    );

    if (rows.length === 0) {
      return c.json({ error: "Page not found" }, 404);
    }

    if (rows[0].path_blocked) {
      return c.json({ error: "Main page path cannot be changed" }, 400);
    }

    const { path_blocked, ...page } = rows[0];

    return page;
  } catch (error) {
    if (error.code === "23505") {
      return c.json({ error: "Page already exists" }, 409);
    }

    console.error("Failed to update page details", error);
    return c.json({ error: "Internal server error" }, 500);
  }
}
