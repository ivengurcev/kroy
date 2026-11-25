export function isLexicalDocument(value) {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value)
        && value.root?.type === 'root' && Array.isArray(value.root.children));
}

export function hasRichText(value) {
    if (typeof value === 'string') return Boolean(value.trim());
    const node = isLexicalDocument(value) ? value.root : value;
    if (!node || typeof node !== 'object') return false;
    if (node.type === 'horizontalrule') return true;
    return typeof node.text === 'string' && Boolean(node.text.trim())
        || Array.isArray(node.children) && node.children.some(hasRichText);
}

export function normalizeRichText(value) {
    if (!hasRichText(value)) return '';
    if (typeof value === 'string') return value.trim();
    return isLexicalDocument(value) ? value : '';
}

// Match the historical parts' paragraph splitting; strings are never parsed as HTML.
export function richTextParagraphs(value) {
    return typeof value === 'string'
        ? value.replace(/\r\n?/g, '\n').split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean)
        : [];
}
