export function isLexicalDocument(value) {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value)
        && value.root?.type === 'root' && Array.isArray(value.root.children));
}

// The structure enforced by Lexical's registered paragraph, heading, list and link nodes.
const inlineNodes = ['text', 'tab', 'linebreak', 'link', 'autolink'];
const blockNodes = ['paragraph', 'heading', 'list', 'horizontalrule'];
const childrenByType = {
    root: blockNodes,
    paragraph: inlineNodes,
    heading: inlineNodes,
    link: ['text', 'tab', 'linebreak'],
    autolink: ['text', 'tab', 'linebreak'],
    list: ['listitem'],
    listitem: [...inlineNodes, 'list'],
};

export function isSupportedLexicalDocument(value) {
    function valid(node, types, depth) {
        if (depth > 512 || !node || typeof node !== 'object' || Array.isArray(node)
            || !types.includes(node.type) || node.version !== 1) return false;
        const children = childrenByType[node.type];
        if (children) {
            if (!Array.isArray(node.children) || ![null, undefined, 'ltr', 'rtl'].includes(node.direction)
                || (node.format !== undefined && typeof node.format !== 'string')
                || (node.indent !== undefined && !Number.isInteger(node.indent))) return false;
            if (node.type === 'heading' && !/^h[1-6]$/.test(node.tag)) return false;
            if (['link', 'autolink'].includes(node.type) && typeof node.url !== 'string') return false;
            if (node.type === 'list' && (!['bullet', 'number', 'check'].includes(node.listType)
                || node.tag !== (node.listType === 'number' ? 'ol' : 'ul') || !Number.isFinite(node.start))) return false;
            if (node.type === 'listitem' && !Number.isFinite(node.value)) return false;
            return node.children.every((child) => valid(child, children, depth + 1));
        }
        if (Object.hasOwn(node, 'children')) return false;
        return !['text', 'tab'].includes(node.type) || (typeof node.text === 'string'
            && Number.isInteger(node.format) && Number.isInteger(node.detail)
            && typeof node.style === 'string' && ['normal', 'token', 'segmented'].includes(node.mode));
    }
    return isLexicalDocument(value) && valid(value.root, ['root'], 0);
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
