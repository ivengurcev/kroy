import { pool } from "../db/client.mjs";
import getHostname from "./getHostname.mjs";
import {
  isPlainObject,
  isValidPagePath,
  normalizePageTitle,
} from "./pageFields.mjs";

export default async function postPage(c) {
  let body;

  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid request" }, 400);
  }

  const keys = isPlainObject(body) ? Object.keys(body) : [];
  const title = normalizePageTitle(body?.title);

  if (
    keys.length !== 2
    || !keys.includes("title")
    || !keys.includes("path")
    || !title
    || !isValidPagePath(body.path)
  ) {
    return c.json({ error: "Invalid page" }, 400);
  }

  const hostname = getHostname(c);

  if (!hostname) return c.json({ error: "Site not found" }, 404);

  try {
    const { rows } = await pool.query(
      `INSERT INTO pages (site_id, title, path, content)
       SELECT d.site_id, $1, $2, '[]'::jsonb
       FROM domains d
       WHERE d.hostname = $3
       RETURNING id, site_id, path, title, content`,
      [title, body.path, hostname],
    );

    if (rows.length === 0) {
      return c.json({ error: "Site not found" }, 404);
    }

    return c.json(rows[0], 201);
  } catch (error) {
    if (error.code === "23505") {
      return c.json({ error: "Page already exists" }, 409);
    }

    console.error("Failed to create page", error);
    return c.json({ error: "Internal server error" }, 500);
  }
}
