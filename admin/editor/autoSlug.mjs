import { slugifyPageTitle } from '../../shared/pageFields.mjs';

export function generatedSlug(title, { prefix = '', maxLength = 200 } = {}) {
    const slug = slugifyPageTitle(title).slice(0, maxLength).replace(/-$/, '');
    return slug ? `${prefix}${slug}` : '';
}

export function resolveAutoSlug({ title, value, enabled = true, manuallyEdited = false, prefix = '', maxLength = 200 }) {
    return enabled && !manuallyEdited ? generatedSlug(title, { prefix, maxLength }) : value;
}
