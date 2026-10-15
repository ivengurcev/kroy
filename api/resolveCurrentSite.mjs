import { pool } from "../db/client.mjs";

function getHostname(c) {
  const host = c.req.header("Host");

  if (!host || /[/?#@\s]/.test(host)) return null;

  try {
    return new URL(`http://${host}`).hostname.toLowerCase().replace(/\.$/, "");
  } catch {
    return null;
  }
}

export default async function resolveCurrentSite(c) {
  const hostname = getHostname(c);

  if (!hostname) return null;

  const { rows } = await pool.query(
    `SELECT sites.id, sites.slug, sites.name
     FROM domains
     JOIN sites ON sites.id = domains.site_id
     WHERE domains.hostname = $1`,
    [hostname],
  );

  return rows[0] ?? null;
}
