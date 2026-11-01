import test from 'node:test';
import assert from 'node:assert/strict';
import {
    getThemeTokens,
    normalizeThemeOverrides,
    resetThemeOverride,
    setThemeOverride,
} from './themeRegistry.mjs';

const token = '--site-color-bg';

test('light and dark overrides are stored independently', () => {
    let overrides = normalizeThemeOverrides('calm', 'light');
    overrides = setThemeOverride('calm', 'light', overrides, token, '#111111');
    overrides = setThemeOverride('calm', 'dark', overrides, token, '#eeeeee');

    assert.equal(overrides.light[token], '#111111');
    assert.equal(overrides.dark[token], '#eeeeee');
    assert.equal(getThemeTokens('calm', 'light', overrides)[token], '#111111');
    assert.equal(getThemeTokens('calm', 'dark', overrides)[token], '#eeeeee');
});

test('changing mode preserves both palette overrides', () => {
    const overrides = {
        light: { [token]: '#111111' },
        dark: { [token]: '#eeeeee' },
    };

    assert.deepEqual(normalizeThemeOverrides('calm', 'dark', overrides), overrides);
});

test('reset affects only the selected palette', () => {
    const overrides = {
        light: { [token]: '#111111' },
        dark: { [token]: '#eeeeee' },
    };
    const next = resetThemeOverride('calm', 'light', overrides, token);

    assert.deepEqual(next, { light: {}, dark: { [token]: '#eeeeee' } });
});
