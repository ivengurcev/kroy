import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const THEMES_DIR = dirname(fileURLToPath(import.meta.url));
const THEME_FILE_PATTERN = /^[a-z][a-z0-9-]*\.json$/;
const TOKEN_PATTERN = /^--site-[a-z0-9-]+$/;
const PALETTE_TOKENS = ['--site-color-bg', '--site-color-text', '--site-color-accent'];
const SHARED_STATUS_TOKENS = {
    '--site-color-danger': '#b42318',
    '--site-color-info': '#2563eb',
    '--site-color-success': '#16803c',
    '--site-color-warning': '#9a6700',
};

function isPlainObject(value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

function assertTheme(theme, fileName) {
    const expectedId = fileName.replace(/\.json$/, '');
    if (!isPlainObject(theme) || theme.id !== expectedId || !/^[a-z][a-z0-9-]*$/.test(theme.id)) throw new Error(`Некорректная тема ${fileName}`);
    if (typeof theme.name !== 'string' || !theme.name.trim()) throw new Error(`У темы ${fileName} не задано название`);
    if (!isPlainObject(theme.tokens?.light) || !isPlainObject(theme.tokens?.dark)) throw new Error(`У темы ${fileName} не заданы палитры`);
    const lightTokens = Object.keys(theme.tokens.light).sort();
    const darkTokens = Object.keys(theme.tokens.dark).sort();
    if (JSON.stringify(lightTokens) !== JSON.stringify(darkTokens)) throw new Error(`Палитры темы ${fileName} должны совпадать`);
    for (const palette of ['light', 'dark']) {
        for (const [token, value] of Object.entries(theme.tokens[palette])) {
            if (!TOKEN_PATTERN.test(token) || typeof value !== 'string' || !value.trim()) throw new Error(`Некорректный токен ${token} в ${fileName}`);
        }
    }
}

function loadThemes() {
    const themes = new Map();
    for (const file of readdirSync(THEMES_DIR).filter((item) => THEME_FILE_PATTERN.test(item)).sort()) {
        const theme = JSON.parse(readFileSync(join(THEMES_DIR, file), 'utf8'));
        assertTheme(theme, file);
        themes.set(theme.id, theme);
    }
    if (!themes.size) throw new Error('Не найдено ни одной темы оформления');
    return themes;
}

const themes = loadThemes();

export function getTheme(themeId) {
    const theme = themes.get(themeId);
    if (!theme) throw new Error(`Неизвестная тема оформления: ${themeId}`);
    return theme;
}

function resolveThemeMode(mode, systemMode = 'light') {
    if (mode === 'light' || mode === 'dark') return mode;
    if (mode === 'system' && (systemMode === 'light' || systemMode === 'dark')) return systemMode;
    throw new Error(`Некорректный режим темы: ${mode}`);
}

function sharedDefaults(theme) {
    return {
        ...SHARED_STATUS_TOKENS,
        '--site-font-body': theme.tokens.light['--site-font-body'],
        '--site-font-heading': theme.tokens.light['--site-font-heading'],
        '--site-font-size-base': theme.tokens.light['--site-font-size-base'],
        '--site-line-height': theme.tokens.light['--site-line-height'],
        '--site-space-base': theme.tokens.light['--site-space-base'],
        '--site-radius-base': theme.tokens.light['--site-radius-base'],
        '--site-container-max': theme.tokens.light['--site-container-max'],
        '--site-page-gutter': theme.tokens.light['--site-page-gutter'],
    };
}

function paletteDefaults(theme, palette) {
    return Object.fromEntries(PALETTE_TOKENS.map((token) => [token, theme.tokens[palette][token]]));
}

function allowedTokens(theme, palette) {
    return palette === 'shared' ? Object.keys(sharedDefaults(theme)) : PALETTE_TOKENS;
}

function validateOverrides(theme, palette, value, ignoreUnknown = false) {
    if (!isPlainObject(value)) throw new Error('Переопределения должны быть объектом');
    for (const [token, tokenValue] of Object.entries(value)) {
        if (!allowedTokens(theme, palette).includes(token)) {
            if (ignoreUnknown) continue;
            throw new Error(`Неизвестный токен темы: ${token}`);
        }
        if (typeof tokenValue !== 'string' || !tokenValue.trim()) throw new Error(`Некорректное значение токена: ${token}`);
    }
    return Object.fromEntries(Object.entries(value).filter(([token]) => allowedTokens(theme, palette).includes(token)));
}

function normalizeOverrideShape(theme, mode, overrides = {}) {
    if (!isPlainObject(overrides)) throw new Error('Переопределения темы должны быть объектом');
    const hasPalettes = Object.hasOwn(overrides, 'light') || Object.hasOwn(overrides, 'dark');
    const hasShared = Object.hasOwn(overrides, 'shared');
    if (!hasPalettes) {
        if (hasShared) {
            return { light: {}, dark: {}, shared: validateOverrides(theme, 'shared', overrides.shared ?? {}, true) };
        }
        const palette = mode === 'dark' ? 'dark' : 'light';
        const paletteValues = Object.fromEntries(Object.entries(overrides).filter(([token]) => PALETTE_TOKENS.includes(token)));
        const sharedValues = Object.fromEntries(Object.entries(overrides).filter(([token]) => Object.hasOwn(sharedDefaults(theme), token)));
        const result = { light: palette === 'light' ? validateOverrides(theme, 'light', paletteValues) : {}, dark: palette === 'dark' ? validateOverrides(theme, 'dark', paletteValues) : {} };
        if (Object.keys(sharedValues).length) result.shared = validateOverrides(theme, 'shared', sharedValues);
        return result;
    }
    const result = { light: validateOverrides(theme, 'light', overrides.light ?? {}, true), dark: validateOverrides(theme, 'dark', overrides.dark ?? {}, true) };
    if (hasShared) {
        result.shared = validateOverrides(theme, 'shared', overrides.shared ?? {}, true);
    } else {
        const legacyShared = {};
        for (const source of [overrides.light ?? {}, overrides.dark ?? {}]) {
            for (const [token, value] of Object.entries(source)) {
                if (Object.hasOwn(sharedDefaults(theme), token) && !Object.hasOwn(legacyShared, token)) legacyShared[token] = value;
            }
        }
        if (Object.keys(legacyShared).length) result.shared = validateOverrides(theme, 'shared', legacyShared);
    }
    return result;
}

function computedTokens() {
    return {
        '--site-color-text-secondary': 'color-mix(in srgb, var(--site-color-text) 72%, var(--site-color-bg))',
        '--site-color-border': 'color-mix(in srgb, var(--site-color-text) 24%, transparent)',
        '--site-color-surface': 'color-mix(in srgb, var(--site-color-bg) 94%, var(--site-color-text))',
        '--site-color-surface-soft': 'color-mix(in srgb, var(--site-color-bg) 86%, var(--site-color-text))',
        '--site-color-accent-hover': 'color-mix(in srgb, var(--site-color-accent) 82%, var(--site-color-text))',
        '--site-color-danger-soft': 'color-mix(in srgb, var(--site-color-danger) 14%, var(--site-color-bg))',
        '--site-color-info-soft': 'color-mix(in srgb, var(--site-color-info) 14%, var(--site-color-bg))',
        '--site-color-success-soft': 'color-mix(in srgb, var(--site-color-success) 14%, var(--site-color-bg))',
        '--site-color-warning-soft': 'color-mix(in srgb, var(--site-color-warning) 14%, var(--site-color-bg))',
        '--site-space-1': 'var(--site-space-base)',
        '--site-space-2': 'calc(var(--site-space-base) * 2)',
        '--site-space-3': 'calc(var(--site-space-base) * 3)',
        '--site-space-4': 'calc(var(--site-space-base) * 4)',
        '--site-space-6': 'calc(var(--site-space-base) * 6)',
        '--site-space-8': 'calc(var(--site-space-base) * 8)',
        '--site-space-12': 'calc(var(--site-space-base) * 12)',
        '--site-space-16': 'calc(var(--site-space-base) * 16)',
        '--site-radius-sm': 'calc(var(--site-radius-base) * .5)',
        '--site-radius-md': 'var(--site-radius-base)',
        '--site-radius-lg': 'calc(var(--site-radius-base) * 1.5)',
    };
}

export function listThemes() {
    return [...themes.values()].map(({ id, name, description }) => ({ id, name, description }));
}

export function getThemeEditorModel(themeId) {
    const theme = getTheme(themeId);
    return { id: theme.id, name: theme.name, description: theme.description, palettes: { light: paletteDefaults(theme, 'light'), dark: paletteDefaults(theme, 'dark') }, shared: sharedDefaults(theme) };
}

export function getThemeTokens(themeId, mode, overrides = {}, systemMode = 'light') {
    const theme = getTheme(themeId);
    const palette = resolveThemeMode(mode, systemMode);
    const normalized = normalizeOverrideShape(theme, mode, overrides);
    return { ...paletteDefaults(theme, palette), ...sharedDefaults(theme), ...(normalized[palette] ?? {}), ...(normalized.shared ?? {}), ...computedTokens() };
}

export function normalizeThemeOverrides(themeId, mode, overrides = {}) {
    const theme = getTheme(themeId);
    resolveThemeMode(mode);
    return normalizeOverrideShape(theme, mode, overrides);
}

export function setThemeOverride(themeId, palette, overrides, token, value) {
    const theme = getTheme(themeId);
    if (!['light', 'dark', 'shared'].includes(palette)) throw new Error(`Некорректная палитра темы: ${palette}`);
    if (!allowedTokens(theme, palette).includes(token)) throw new Error(`Неизвестный токен темы: ${token}`);
    if (typeof value !== 'string' || !value.trim()) throw new Error(`Некорректное значение токена: ${token}`);
    const normalized = normalizeThemeOverrides(themeId, palette === 'shared' ? 'light' : palette, overrides);
    normalized[palette] ||= {};
    const defaults = palette === 'shared' ? sharedDefaults(theme) : paletteDefaults(theme, palette);
    if (value === defaults[token]) delete normalized[palette][token];
    else normalized[palette][token] = value;
    return normalized;
}

export function resetThemeOverride(themeId, palette, overrides, token) {
    const theme = getTheme(themeId);
    if (!['light', 'dark', 'shared'].includes(palette) || !allowedTokens(theme, palette).includes(token)) throw new Error(`Неизвестный токен темы: ${token}`);
    const normalized = normalizeThemeOverrides(themeId, palette === 'shared' ? 'light' : palette, overrides);
    normalized[palette] ||= {};
    delete normalized[palette][token];
    return normalized;
}
