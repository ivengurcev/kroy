import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const THEMES_DIR = dirname(fileURLToPath(import.meta.url));
const THEME_FILE_PATTERN = /^[a-z][a-z0-9-]*\.json$/;
const TOKEN_PATTERN = /^--site-[a-z0-9-]+$/;

function isPlainObject(value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

function assertTheme(theme, fileName) {
    if (!isPlainObject(theme)) throw new Error(`Тема ${fileName} должна быть объектом`);

    const expectedId = fileName.replace(/\.json$/, '');
    if (typeof theme.id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(theme.id)) {
        throw new Error(`Некорректный id темы в ${fileName}`);
    }
    if (theme.id !== expectedId) {
        throw new Error(`id темы ${theme.id} не совпадает с именем файла ${fileName}`);
    }
    if (typeof theme.name !== 'string' || !theme.name.trim()) {
        throw new Error(`У темы ${fileName} не задано название`);
    }
    if (theme.description !== undefined && typeof theme.description !== 'string') {
        throw new Error(`Описание темы ${fileName} должно быть строкой`);
    }
    if (!isPlainObject(theme.tokens)) {
        throw new Error(`У темы ${fileName} не заданы токены`);
    }

    const light = theme.tokens.light;
    const dark = theme.tokens.dark;
    if (!isPlainObject(light) || !isPlainObject(dark)) {
        throw new Error(`Тема ${fileName} должна содержать наборы токенов light и dark`);
    }

    const lightTokens = Object.keys(light).sort();
    const darkTokens = Object.keys(dark).sort();
    if (JSON.stringify(lightTokens) !== JSON.stringify(darkTokens)) {
        throw new Error(`Наборы токенов light и dark темы ${fileName} должны совпадать`);
    }

    for (const mode of ['light', 'dark']) {
        for (const [token, value] of Object.entries(theme.tokens[mode])) {
            if (!TOKEN_PATTERN.test(token)) {
                throw new Error(`Некорректный токен ${token} в теме ${fileName}`);
            }
            if (typeof value !== 'string' || !value.trim()) {
                throw new Error(`Некорректное значение токена ${token} в теме ${fileName}`);
            }
        }
    }
}

function loadThemes() {
    const themes = new Map();
    const files = readdirSync(THEMES_DIR)
        .filter((file) => THEME_FILE_PATTERN.test(file))
        .sort();

    for (const file of files) {
        const theme = JSON.parse(readFileSync(join(THEMES_DIR, file), 'utf8'));
        assertTheme(theme, file);
        if (themes.has(theme.id)) throw new Error(`Тема ${theme.id} объявлена несколько раз`);
        themes.set(theme.id, theme);
    }

    if (themes.size === 0) throw new Error('Не найдено ни одной темы оформления');
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
    if (mode === 'system') throw new Error(`Некорректный системный режим: ${systemMode}`);
    throw new Error(`Некорректный режим темы: ${mode}`);
}

function validateOverrides(theme, overrides) {
    if (!isPlainObject(overrides)) {
        throw new Error('Переопределения темы должны быть объектом');
    }

    for (const [token, value] of Object.entries(overrides)) {
        if (!Object.hasOwn(theme.tokens.light, token)) {
            throw new Error(`Неизвестный токен темы: ${token}`);
        }
        if (typeof value !== 'string' || !value.trim()) {
            throw new Error(`Некорректное значение токена: ${token}`);
        }
    }

    return overrides;
}

function isRedundant(theme, mode, token, value) {
    if (mode === 'system') {
        return value === theme.tokens.light[token] && value === theme.tokens.dark[token];
    }
    return value === theme.tokens[mode][token];
}

export function listThemes() {
    return [...themes.values()].map(({ id, name, description }) => ({ id, name, description }));
}

export function getThemeTokens(themeId, mode, overrides = {}, systemMode = 'light') {
    const theme = getTheme(themeId);
    const resolvedMode = resolveThemeMode(mode, systemMode);
    return {
        ...theme.tokens[resolvedMode],
        ...validateOverrides(theme, overrides),
    };
}

export function normalizeThemeOverrides(themeId, mode, overrides = {}) {
    const theme = getTheme(themeId);
    resolveThemeMode(mode);
    const normalized = {};

    for (const [token, value] of Object.entries(validateOverrides(theme, overrides))) {
        if (!isRedundant(theme, mode, token, value)) normalized[token] = value;
    }

    return normalized;
}

export function setThemeOverride(themeId, mode, overrides, token, value) {
    const theme = getTheme(themeId);
    resolveThemeMode(mode);

    if (!Object.hasOwn(theme.tokens.light, token)) {
        throw new Error(`Неизвестный токен темы: ${token}`);
    }
    if (typeof value !== 'string' || !value.trim()) {
        throw new Error(`Некорректное значение токена: ${token}`);
    }

    const normalized = normalizeThemeOverrides(themeId, mode, overrides);
    if (isRedundant(theme, mode, token, value)) {
        delete normalized[token];
    } else {
        normalized[token] = value;
    }
    return normalized;
}

export function resetThemeOverride(themeId, mode, overrides, token) {
    const theme = getTheme(themeId);
    resolveThemeMode(mode);

    if (!Object.hasOwn(theme.tokens.light, token)) {
        throw new Error(`Неизвестный токен темы: ${token}`);
    }

    const normalized = normalizeThemeOverrides(themeId, mode, overrides);
    delete normalized[token];
    return normalized;
}
