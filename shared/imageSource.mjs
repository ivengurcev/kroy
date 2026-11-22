export function normalizeImageSource(value) {
    const source = typeof value === 'string' ? value : value?.src;
    const src = typeof source === 'string' ? source.trim() : '';
    if (!/^(?:\/|https?:\/\/)/i.test(src)) return '';
    const mimeType = typeof value === 'object' && value !== null ? value.mimeType : undefined;
    return { src, mimeType: mimeType || (/\.svg(?:[?#]|$)/i.test(src) ? 'image/svg+xml' : undefined) };
}
