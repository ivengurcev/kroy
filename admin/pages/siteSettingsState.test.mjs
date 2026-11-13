import assert from 'node:assert/strict';
import test from 'node:test';
import { siteSettingsDirty, siteSettingsWorkspaceKey } from './siteSettingsState.mjs';

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
