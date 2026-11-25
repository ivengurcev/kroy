// Theme models come from the existing registry, never from page content.
export function resolveAppearanceSettings(site, appearance = {}) {
    const themeId = appearance.themeId ?? site.themeId;
    const inherited = themeId === site.themeId ? site.overrides : { shared: site.overrides?.shared };
    return {
        themeId,
        themeMode: appearance.themeMode ?? site.themeMode,
        overrides: Object.fromEntries(['light', 'dark', 'shared'].map((palette) => [
            palette, { ...inherited?.[palette], ...appearance.overrides?.[palette] },
        ])),
    };
}

export function appearanceEditorModel(settings, themes) {
    const theme = themes.find(({ id }) => id === settings.themeId);
    if (!theme) throw new Error('Неизвестная тема оформления');
    return {
        ...theme,
        palettes: Object.fromEntries(['light', 'dark'].map((palette) => [
            palette, { ...theme.palettes[palette], ...settings.overrides?.[palette] },
        ])),
        shared: { ...theme.shared, ...settings.overrides?.shared },
    };
}

export function resolveAppearanceTheme(site, appearance, themes, baseTheme) {
    const settings = resolveAppearanceSettings(site, appearance);
    const model = appearanceEditorModel(settings, themes);
    return {
        mode: settings.themeMode,
        ...Object.fromEntries(['light', 'dark'].map((palette) => [
            palette, { ...baseTheme[palette], ...model.palettes[palette], ...model.shared },
        ])),
    };
}

export function setPageAppearanceToken(appearance, base, palette, token, value) {
    const inherited = palette === 'shared' ? base.shared[token] : base.palettes[palette][token];
    const overrides = { ...appearance.overrides, [palette]: { ...appearance.overrides?.[palette] } };
    // Controls may use numeric values; color controls normalize opaque HEX to HEX8.
    const same = (left, right) => String(left).trim().toLowerCase().replace(/^(#[\da-f]{6})ff$/, '$1')
        === String(right).trim().toLowerCase().replace(/^(#[\da-f]{6})ff$/, '$1');
    if (value === undefined || String(value).trim() === '' || same(value, inherited)) delete overrides[palette][token];
    else overrides[palette][token] = String(value).trim();
    const next = { ...appearance };
    for (const group of Object.keys(overrides)) if (!Object.keys(overrides[group]).length) delete overrides[group];
    if (Object.keys(overrides).length) next.overrides = overrides;
    else delete next.overrides;
    return next;
}

export function changePageAppearanceTheme(appearance, themeId) {
    const { overrides, ...next } = appearance;
    if (overrides?.shared && Object.keys(overrides.shared).length) next.overrides = { shared: { ...overrides.shared } };
    if (themeId) next.themeId = themeId;
    else delete next.themeId;
    return next;
}
