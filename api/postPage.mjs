import { pool } from "../db/client.mjs";
import getHostname from "./getHostname.mjs";
import {
  isPlainObject,
  isValidPagePath,
  normalizePageTitle,
} from "./pageFields.mjs";
import findPageRouteConflict from "./pageRouteConflicts.mjs";
import { isPageDataSource } from "../pageDataSources.mjs";

export default async function postPage(c) {
  let body;

  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid request" }, 400);
  }

  const keys = isPlainObject(body) ? Object.keys(body) : [];
  const title = normalizePageTitle(body?.title);
  const type = body?.type ?? "standard";
  const dataSource = body?.dataSource ?? null;

  if (
    keys.some((key) => !["title", "path", "type", "dataSource"].includes(key))
    || !keys.includes("title")
    || !keys.includes("path")
    || !title
    || !isValidPagePath(body.path)
    || !["standard", "list"].includes(type)
    || (type === "list" ? !isPageDataSource(dataSource) : dataSource !== null)
  ) {
    return c.json({ error: "Invalid page" }, 400);
  }

  const hostname = getHostname(c);

  if (!hostname) return c.json({ error: "Site not found" }, 404);

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
      return c.json({ error: "Site not found" }, 404);
    }

    const siteId = sites[0].id;
    const conflict = await findPageRouteConflict(client, siteId, body.path);

    if (conflict) {
      await client.query("ROLLBACK");
      return c.json({ error: "Page already exists" }, 409);
    }

    const { rows } = await client.query(
      `INSERT INTO pages (site_id, title, path, content, page_type, data_source)
       VALUES ($1, $2, $3, '[]'::jsonb, $4, $5)
       RETURNING id, site_id, path, title, content, page_type AS type, data_source AS "dataSource"`,
      [siteId, title, body.path, type, dataSource],
    );

    await client.query("COMMIT");

    return c.json(rows[0], 201);
  } catch (error) {
    await client?.query("ROLLBACK").catch(() => {});

    if (error.code === "23505") {
      return c.json({ error: "Page already exists" }, 409);
    }

    console.error("Failed to create page", error);
    return c.json({ error: "Internal server error" }, 500);
  } finally {
    client?.release();
  }
}
