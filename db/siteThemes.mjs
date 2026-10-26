import { pool } from "./client.mjs";
import {
  normalizeThemeOverrides,
  resetThemeOverride,
  setThemeOverride,
} from "../themes/themeRegistry.mjs";

function toSiteTheme(row) {
  if (!row) return null;
  return {
    themeId: row.theme_id,
    themeMode: row.theme_mode,
    overrides: row.theme_overrides,
  };
}

export async function getSiteTheme(siteId) {
  const {
    rows: [row],
  } = await pool.query(
    `SELECT theme_id, theme_mode, theme_overrides
     FROM sites
     WHERE id = $1`,
    [siteId],
  );
  return toSiteTheme(row);
}

async function saveSiteTheme(siteId, themeId, themeMode, overrides) {
  const {
    rows: [row],
  } = await pool.query(
    `UPDATE sites
     SET theme_id = $2,
         theme_mode = $3,
         theme_overrides = $4::jsonb
     WHERE id = $1
     RETURNING theme_id, theme_mode, theme_overrides`,
    [siteId, themeId, themeMode, JSON.stringify(overrides)],
  );

  if (!row) throw new Error(`Сайт ${siteId} не найден`);
  return toSiteTheme(row);
}

export async function setSiteTheme(siteId, { themeId, themeMode } = {}) {
  const current = await getSiteTheme(siteId);
  if (!current) throw new Error(`Сайт ${siteId} не найден`);

  const nextThemeId = themeId ?? current.themeId;
  const nextThemeMode = themeMode ?? current.themeMode;
  const overrides = normalizeThemeOverrides(
    nextThemeId,
    nextThemeMode,
    current.overrides,
  );

  return saveSiteTheme(siteId, nextThemeId, nextThemeMode, overrides);
}

export async function setSiteThemeOverride(siteId, token, value) {
  const current = await getSiteTheme(siteId);
  if (!current) throw new Error(`Сайт ${siteId} не найден`);

  const overrides = setThemeOverride(
    current.themeId,
    current.themeMode,
    current.overrides,
    token,
    value,
  );

  return saveSiteTheme(
    siteId,
    current.themeId,
    current.themeMode,
    overrides,
  );
}

export async function resetSiteThemeOverride(siteId, token) {
  const current = await getSiteTheme(siteId);
  if (!current) throw new Error(`Сайт ${siteId} не найден`);

  const overrides = resetThemeOverride(
    current.themeId,
    current.themeMode,
    current.overrides,
    token,
  );

  return saveSiteTheme(
    siteId,
    current.themeId,
    current.themeMode,
    overrides,
  );
}
