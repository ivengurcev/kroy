import test from 'node:test';
import assert from 'node:assert/strict';
import { getPageTheme, getThemeTokens, getThemeEditorModel, normalizePageAppearance } from './themeRegistry.mjs';
import { resolveAppearanceSettings, appearanceEditorModel, setPageAppearanceToken, changePageAppearanceTheme, resolveAppearanceTheme } from '../../shared/pageAppearance.mjs';

const bg = '--site-color-bg';
const font = '--site-font-size-base';
const site = { themeId: 'calm', themeMode: 'system', overrides: { light: { [bg]: '#eeddcc' }, dark: {}, shared: { [font]: '18px' } } };

test('empty and null page properties inherit all site settings, including future changes', () => {
    assert.deepEqual(getPageTheme(site), getPageTheme(site, {}));
    assert.deepEqual(getPageTheme(site, {}), {
        mode: 'system', light: getThemeTokens('calm', 'light', site.overrides), dark: getThemeTokens('calm', 'dark', site.overrides),
    });
    assert.deepEqual(normalizePageAppearance(site, { themeId: null, themeMode: null, overrides: { light: {}, dark: {}, shared: {} } }), {});
    assert.equal(getPageTheme({ ...site, overrides: { light: { [bg]: '#abcdef' } } }).light[bg], '#abcdef');
    assert.deepEqual(getPageTheme({ ...site, themeId: 'amber' }), getPageTheme({ ...site, themeId: 'amber' }, {}));
});

test('one page override leaves other tokens inherited and reset returns the site value', () => {
    const appearance = normalizePageAppearance(site, { overrides: { light: { [bg]: '#008800' } } });
    const theme = getPageTheme(site, appearance);
    assert.equal(theme.light[bg], '#008800');
    assert.equal(theme.light[font], '18px');
    assert.equal(theme.dark[font], '18px');
    const base = appearanceEditorModel(resolveAppearanceSettings(site), [getThemeEditorModel('calm')]);
    assert.deepEqual(setPageAppearanceToken(appearance, base, 'light', bg, undefined), {});
    assert.equal(getPageTheme(site, {}).light[bg], '#eeddcc');
    assert.deepEqual(normalizePageAppearance(site, { overrides: { light: { [bg]: '#eeddccff' }, shared: { [font]: '18px' } } }), {});
});

test('explicit theme changes only palettes, shared settings and mode keep inheriting', () => {
    const page = { themeId: 'amber', overrides: { dark: { [bg]: '#101010' } } };
    const theme = getPageTheme(site, page);
    assert.equal(theme.mode, 'system');
    assert.equal(theme.light[bg], getThemeTokens('amber', 'light')[bg]);
    assert.equal(theme.light[font], '18px');
    assert.equal(theme.dark[bg], '#101010');
    assert.equal(getPageTheme({ ...site, themeId: 'amber' }, { themeId: 'calm' }).light[bg], getThemeTokens('calm', 'light')[bg]);
    assert.equal(getPageTheme(site, { themeMode: 'dark' }).mode, 'dark');
    assert.deepEqual(changePageAppearanceTheme({ ...page, themeMode: 'dark' }, 'calm'), { themeId: 'calm', themeMode: 'dark' });
    assert.deepEqual(changePageAppearanceTheme(page, null), {});
    const shared = { [font]: '20px', '--site-font-heading': 'Oswald, Arial, sans-serif', '--site-radius-base': '8px' };
    const own = { ...page, overrides: { ...page.overrides, shared } };
    assert.deepEqual(changePageAppearanceTheme(own, 'calm'), { themeId: 'calm', overrides: { shared } });
    const preview = resolveAppearanceTheme(site, own, [getThemeEditorModel('amber')], getPageTheme(site));
    assert.deepEqual(preview, getPageTheme(site, own));
    assert.equal(preview.light[font], '20px');
    assert.deepEqual(normalizePageAppearance(site, { themeId: 'amber', overrides: { shared: { [font]: '18px' } } }), { themeId: 'amber' });
    assert.deepEqual(normalizePageAppearance(site, { themeId: 'calm', themeMode: 'system' }), { themeId: 'calm', themeMode: 'system' });
});

test('page validation rejects arbitrary CSS, malformed groups, values, themes and HR settings', () => {
    for (const appearance of [
        null, [], { themeId: 'missing' }, { themeMode: 'auto' }, { separatorMediaId: null },
        { overrides: null }, { overrides: { other: {} } }, { overrides: { light: [] } },
        { overrides: { light: { '--anything': 'red' } } },
        { overrides: { light: { [font]: '18px' } } },
        { overrides: { shared: { '--site-color-accent': '#abcdef' } } },
        { overrides: { light: { [bg]: 'url(https://example.com)' } } },
        { overrides: { light: { [bg]: '#abc; color:red' } } },
        { overrides: { shared: { [font]: '-20px' } } },
        { overrides: { shared: { [font]: '0px' } } },
        { overrides: { shared: { '--site-line-width': '9px' } } },
        { overrides: { shared: { '--site-font-body': 'Arial; background:red' } } },
        { overrides: { shared: { '--site-line-height': Infinity } } },
    ]) assert.throws(() => normalizePageAppearance(site, appearance));
    assert.deepEqual(normalizePageAppearance(site, { overrides: { shared: { '--site-line-height': '1.8', '--site-space-base': '6px' } } }),
        { overrides: { shared: { '--site-line-height': '1.8', '--site-space-base': '6px' } } });
});
