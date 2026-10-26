import { pool } from "../db/client.mjs";
import { getSiteTheme, setSiteTheme } from "../db/siteThemes.mjs";
import getHostname from "./getHostname.mjs";
import { getTheme, listThemes } from "../themes/themeRegistry.mjs";

async function getCurrentSite(c) {
  const hostname = getHostname(c);
  if (!hostname) return null;

  const { rows: [site] } = await pool.query(
    `SELECT s.id
     FROM sites s
     JOIN domains d ON d.site_id = s.id
     WHERE d.hostname = $1`,
    [hostname],
  );

  return site ?? null;
}

function themeDetails() {
  return listThemes().map((theme) => ({
    ...theme,
    tokens: getTheme(theme.id).tokens,
  }));
}

export async function getSiteThemeSettings(c) {
  try {
    const site = await getCurrentSite(c);
    if (!site) return c.json({ error: "Site not found" }, 404);

    const settings = await getSiteTheme(site.id);
    return c.json({ themes: themeDetails(), settings });
  } catch (error) {
    console.error("Failed to load site theme", error);
    return c.json({ error: "Internal server error" }, 500);
  }
}

export async function patchSiteTheme(c) {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid request" }, 400);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return c.json({ error: "Invalid theme settings" }, 400);
  }

  try {
    const site = await getCurrentSite(c);
    if (!site) return c.json({ error: "Site not found" }, 404);

    const settings = await setSiteTheme(site.id, {
      themeId: body.themeId,
      themeMode: body.themeMode,
      overrides: body.overrides,
    });
    return c.json(settings);
  } catch (error) {
    if (/Некоррект|Неизвестный/.test(error.message)) {
      return c.json({ error: error.message }, 400);
    }
    console.error("Failed to save site theme", error);
    return c.json({ error: "Internal server error" }, 500);
  }
}
