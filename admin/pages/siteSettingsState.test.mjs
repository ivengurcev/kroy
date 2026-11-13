import assert from 'node:assert/strict';
import test from 'node:test';
import { isPreservedSiteSettingsNavigation, siteSettingsDirty, siteSettingsWorkspaceKey } from './siteSettingsState.mjs';

test('save availability belongs to the active section; global warnings retain all changes', () => {
    for (const changed of ['appearance', 'contacts', 'seo']) {
        const changes = { appearance: false, contacts: false, seo: false, [changed]: true };
        for (const section of ['appearance', 'contacts', 'seo', 'overview']) {
            assert.deepEqual(siteSettingsDirty(section, changes), { active: section === changed, any: true });
        }
    }
    assert.deepEqual(siteSettingsDirty('seo', { appearance: false, contacts: false, seo: false }), { active: false, any: false });
});
test('switching settings sections does not remount SitePage; unrelated routes retain their keys', () => {
    const keys = ['/admin/appearance', '/admin/contacts', '/admin/seo'].map(siteSettingsWorkspaceKey);
    assert.equal(new Set(keys).size, 1);
    assert.equal(siteSettingsWorkspaceKey('/admin/pages/page-id'), '/admin/pages/page-id');
    assert.equal(siteSettingsWorkspaceKey('/admin/materials'), '/admin/materials');
});

test('only same-origin transitions within the three preserved settings routes skip confirmation', () => {
    const url = (path) => new URL(path, 'https://site.example.org');
    const settings = ['/admin/appearance', '/admin/contacts', '/admin/seo'];
    for (const from of settings) {
        for (const to of settings) {
            assert.equal(isPreservedSiteSettingsNavigation(url(from), url(`${to}?tab=details#field`)), true);
            assert.equal(siteSettingsWorkspaceKey(url(from).pathname), siteSettingsWorkspaceKey(url(to).pathname));
        }
        for (const other of ['/admin/materials', '/admin/pages/page-id', '/admin/catalog', '/admin/overview', '/admin/seo/nested', '/admin/seo/']) {
            assert.equal(isPreservedSiteSettingsNavigation(url(from), url(other)), false);
            assert.equal(isPreservedSiteSettingsNavigation(url(other), url(from)), false);
        }
    }
    assert.equal(isPreservedSiteSettingsNavigation(url('/admin/seo'), new URL('https://other.example.org/admin/contacts')), false);
    assert.equal(isPreservedSiteSettingsNavigation(url('/admin/pages/page-id'), url('/admin/pages/page-id')), false);
    assert.equal(isPreservedSiteSettingsNavigation(undefined, url('/admin/seo')), false);
    assert.equal(isPreservedSiteSettingsNavigation(url('/admin/seo'), undefined), false);
});
