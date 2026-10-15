import { pool } from "../db/client.mjs";
import getHostname from "./getHostname.mjs";
import isUuid from "./isUuid.mjs";

export default async function getPage(c) {
  const pageId = c.req.param("pageId");
  const path = c.req.query("path");
  const hostname = getHostname(c);

  if (!hostname) return c.json({ error: "Page not found" }, 404);

  if (pageId === undefined && path === undefined) {
    try {
      const { rows } = await pool.query(
        `SELECT p.id, p.path, p.title
         FROM domains d
         LEFT JOIN pages p ON p.site_id = d.site_id
         WHERE d.hostname = $1
         ORDER BY p.path, p.id`,
        [hostname],
      );

      if (rows.length === 0) {
        return c.json({ error: "Site not found" }, 404);
      }

      return rows.filter(({ id }) => id !== null);
    } catch (error) {
      console.error("Failed to list pages", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  }

  let condition;
  let value;

  if (pageId !== undefined) {
    if (!isUuid(pageId)) {
      return c.json({ error: "Invalid UUID" }, 400);
    }

    condition = "p.id = $1";
    value = pageId;
  } else {
    if (
      typeof path !== "string"
      || !path.startsWith("/")
      || path.includes("?")
      || path.includes("#")
    ) {
      return c.json({ error: "Invalid path" }, 400);
    }

    condition = "p.path = $1";
    value = path;
  }

  try {
    const { rows } = await pool.query(
      `SELECT p.id, p.site_id, p.path, p.title, p.content
       FROM pages p
       JOIN domains d ON d.site_id = p.site_id
       WHERE ${condition}
         AND d.hostname = $2`,
      [value, hostname],
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
