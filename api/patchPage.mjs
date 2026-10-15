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
      return c.json({ error: "Page not found" }, 404);
    }

    const siteId = sites[0].id;
    const { rows: pages } = await client.query(
      `SELECT id, site_id, path, title, content
       FROM pages
       WHERE id = $1
         AND site_id = $2
         AND deleted_at IS NULL
       FOR UPDATE`,
      [pageId, siteId],
    );

    if (pages.length === 0) {
      await client.query("ROLLBACK");
      return c.json({ error: "Page not found" }, 404);
    }

    const page = pages[0];
    const pathChanged = hasPath && body.path !== page.path;

    if (page.path === "/" && pathChanged) {
      await client.query("ROLLBACK");
      return c.json({ error: "Main page path cannot be changed" }, 400);
    }

    if (pathChanged) {
      const { rows: conflicts } = await client.query(
        `SELECT
           EXISTS (
             SELECT 1
             FROM pages
             WHERE site_id = $1
               AND path = $2
               AND id <> $3
           ) AS page_taken,
           (
             SELECT page_id
             FROM redirects
             WHERE site_id = $1
               AND from_path = $2
           ) AS redirect_page_id`,
        [siteId, body.path, pageId],
      );
      const conflict = conflicts[0];

      if (conflict.page_taken || (conflict.redirect_page_id && conflict.redirect_page_id !== pageId)) {
        await client.query("ROLLBACK");
        return c.json({ error: "Page already exists" }, 409);
      }

      if (conflict.redirect_page_id === pageId) {
        await client.query(
          `DELETE FROM redirects
           WHERE site_id = $1
             AND from_path = $2
             AND page_id = $3`,
          [siteId, body.path, pageId],
        );
      }
    }

    const { rows } = await client.query(
      `UPDATE pages
       SET title = CASE WHEN $2::boolean THEN $3 ELSE title END,
           path = CASE WHEN $4::boolean THEN $5 ELSE path END
       WHERE id = $1
       RETURNING id, site_id, path, title, content`,
      [pageId, hasTitle, title, pathChanged, hasPath ? body.path : null],
    );

    if (pathChanged) {
      await client.query(
        `INSERT INTO redirects (site_id, from_path, page_id)
         VALUES ($1, $2, $3)`,
        [siteId, page.path, pageId],
      );
    }

    await client.query("COMMIT");

    return rows[0];
  } catch (error) {
    await client?.query("ROLLBACK").catch(() => {});

    if (error.code === "23505") {
      return c.json({ error: "Page already exists" }, 409);
    }

    console.error("Failed to update page details", error);
    return c.json({ error: "Internal server error" }, 500);
  } finally {
    client?.release();
  }
}
