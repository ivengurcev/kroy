import { useState } from 'react';
import { resolveAutoSlug } from './autoSlug.mjs';

export default function useAutoSlug({ title, value, onChange, enabled = true, identity, prefix = '', maxLength = 200 }) {
    const [editedIdentity, setEditedIdentity] = useState(null);
    return {
        slug: resolveAutoSlug({ title, value, enabled, manuallyEdited: Boolean(editedIdentity && editedIdentity.identity === identity), prefix, maxLength }),
        changeSlug(next) { setEditedIdentity({ identity }); onChange(next); },
    };
}
