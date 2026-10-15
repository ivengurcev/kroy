import { pool } from "../db/client.mjs";

const LOCAL_HOST_SUFFIX = ".localhost";
const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

function getLocalSlug(c) {
  const host = c.req.header("Host");

  if (!host) return null;

  let hostname;

  try {
    hostname = new URL(`http://${host}`).hostname.toLowerCase();
  } catch {
    return null;
  }

  if (!hostname.endsWith(LOCAL_HOST_SUFFIX)) return null;

  const slug = hostname.slice(0, -LOCAL_HOST_SUFFIX.length);

  if (slug === "app" || !SLUG_PATTERN.test(slug)) return null;

  return slug;
}

export default async function getCurrentSite(c) {
  const slug = getLocalSlug(c);

  if (!slug) {
    return c.json({ error: "Site not found" }, 404);
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, slug, name
       FROM sites
       WHERE slug = $1`,
      [slug],
    );

    if (rows.length === 0) {
      return c.json({ error: "Site not found" }, 404);
    }

    return rows[0];
  } catch (error) {
    console.error("Failed to get current site", error);
    return c.json({ error: "Internal server error" }, 500);
  }
}
