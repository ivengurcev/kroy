import { getSiteTheme, setSiteTheme } from "../db/siteThemes.mjs";
import getCurrentSite from "./siteContext.mjs";
import { getThemeEditorModel, listThemes, normalizeThemeOverrides } from "../themes/themeRegistry.mjs";
import { getAllTokenMetadata } from "../themes/tokenMetadata.mjs";

function themeDetails() {
  return listThemes().map(({ id }) => getThemeEditorModel(id));
}

export async function getSiteThemeSettings(c) {
  try {
    const site = await getCurrentSite(c);
    if (!site) return c.json({ error: "Site not found" }, 404);

    const rawSettings = await getSiteTheme(site.id);
    const settings = {
      ...rawSettings,
      overrides: normalizeThemeOverrides(rawSettings.themeId, rawSettings.themeMode, rawSettings.overrides),
    };
    return c.json({ themes: themeDetails(), metadata: getAllTokenMetadata(), settings });
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
