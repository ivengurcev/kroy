export function normalizeHref(value) {
    if (typeof value !== 'string' || !value || /[\u0000-\u0020\u007f\\]/.test(value) || value.startsWith('//')) return '';
    const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(value);
    if (hasScheme && !/^https?:\/\//i.test(value)) return '';
    try {
        const url = new URL(value, 'https://cta.invalid/');
        return ['http:', 'https:'].includes(url.protocol) ? value : '';
    } catch {
        return '';
    }
}
