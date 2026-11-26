export function isValidContactEmail(value) {
    return typeof value === 'string' && value.length <= 254
        && /^[^\s@<>:,;?&#%\\]+@[^\s@<>:,;?&#%\\]+\.[^\s@<>:,;?&#%\\]+$/.test(value);
}

export function contactPhoneHref(value) {
    const target = typeof value === 'string' ? value.trim().replace(/[^+\d]/g, '') : '';
    return /\d/.test(target) ? `tel:${target}` : null;
}
