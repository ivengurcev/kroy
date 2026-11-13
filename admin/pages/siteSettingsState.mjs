const SETTINGS_PATHS = ['/admin/appearance', '/admin/contacts', '/admin/seo'];

export function siteSettingsWorkspaceKey(pathname) {
    return SETTINGS_PATHS.includes(pathname) ? 'site-settings' : pathname;
}

export function isPreservedSiteSettingsNavigation(from, to) {
    return Boolean(from && to && from.origin === to.origin
        && SETTINGS_PATHS.includes(from.pathname) && SETTINGS_PATHS.includes(to.pathname));
}

export function siteSettingsDirty(section, changes) {
    return { active: Boolean(changes[section]), any: Object.values(changes).some(Boolean) };
}
