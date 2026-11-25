import { pool } from "./client.mjs";
import {
  normalizeThemeOverrides,
  resetThemeOverride,
  setThemeOverride,
} from "../site/themes/themeRegistry.mjs";

function toSiteTheme(row) {
  if (!row) return null;
  return {
    themeId: row.theme_id,
    themeMode: row.theme_mode,
    overrides: row.theme_overrides,
    separatorMediaId: row.separator_media_id ?? null,
  };
}

export async function getSiteTheme(siteId) {
  const {
    rows: [row],
  } = await pool.query(
    `SELECT theme_id, theme_mode, theme_overrides, separator_media_id
     FROM sites
     WHERE id = $1`,
    [siteId],
  );
  return toSiteTheme(row);
}

async function saveSiteTheme(siteId, themeId, themeMode, overrides, separatorMediaId) {
  const {
    rows: [row],
  } = await pool.query(
    `UPDATE sites
     SET theme_id = $2,
         theme_mode = $3,
         theme_overrides = $4::jsonb,
         separator_media_id = $5::uuid
     WHERE id = $1
       AND ($5::uuid IS NULL OR EXISTS (SELECT 1 FROM media WHERE id = $5::uuid AND site_id = $1))
     RETURNING theme_id, theme_mode, theme_overrides, separator_media_id`,
    [siteId, themeId, themeMode, JSON.stringify(overrides), separatorMediaId],
  );

  if (!row) throw new Error('Некорректное изображение разделителя');
  return toSiteTheme(row);
}

export async function setSiteTheme(siteId, { themeId, themeMode, overrides, separatorMediaId } = {}) {
  const current = await getSiteTheme(siteId);
  if (!current) throw new Error(`Сайт ${siteId} не найден`);

  const nextThemeId = themeId ?? current.themeId;
  const nextThemeMode = themeMode ?? current.themeMode;
  const nextOverrides = normalizeThemeOverrides(
    nextThemeId,
    nextThemeMode,
    overrides ?? (nextThemeId === current.themeId ? current.overrides : {
      light: {}, dark: {}, shared: normalizeThemeOverrides(current.themeId, current.themeMode, current.overrides).shared ?? {},
    }),
  );

  return saveSiteTheme(siteId, nextThemeId, nextThemeMode, nextOverrides,
    separatorMediaId === undefined ? current.separatorMediaId : separatorMediaId);
}

export async function setSiteThemeOverride(siteId, palette, token, value) {
  const current = await getSiteTheme(siteId);
  if (!current) throw new Error(`Сайт ${siteId} не найден`);

  const overrides = setThemeOverride(
    current.themeId,
    palette,
    current.overrides,
    token,
    value,
  );

  return saveSiteTheme(
    siteId,
    current.themeId,
    current.themeMode,
    overrides,
    current.separatorMediaId,
  );
}

export async function resetSiteThemeOverride(siteId, palette, token) {
  const current = await getSiteTheme(siteId);
  if (!current) throw new Error(`Сайт ${siteId} не найден`);

  const overrides = resetThemeOverride(
    current.themeId,
    palette,
    current.overrides,
    token,
  );

  return saveSiteTheme(
    siteId,
    current.themeId,
    current.themeMode,
    overrides,
    current.separatorMediaId,
  );
}
