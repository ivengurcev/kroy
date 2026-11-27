export function isLexicalDocument(value) {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value)
        && value.root?.type === 'root' && Array.isArray(value.root.children));
}

// The structure enforced by Lexical's registered paragraph, heading, list and link nodes.
const inlineNodes = ['text', 'tab', 'linebreak', 'link', 'autolink'];
const blockNodes = ['paragraph', 'heading', 'list', 'horizontalrule', 'table', 'callout'];
const childrenByType = {
    root: blockNodes,
    paragraph: inlineNodes,
    heading: inlineNodes,
    callout: inlineNodes,
    link: ['text', 'tab', 'linebreak'],
    autolink: ['text', 'tab', 'linebreak'],
    list: ['listitem'],
    listitem: [...inlineNodes, 'list'],
    table: ['tablerow'],
    tablerow: ['tablecell'],
    tablecell: blockNodes.filter((type) => type !== 'table'),
};

function hasNodeType(value, type) {
    const stack = [value?.root ?? value];
    while (stack.length) {
        const node = stack.pop();
        if (node?.type === type) return true;
        if (Array.isArray(node?.children)) stack.push(...node.children);
    }
    return false;
}

export const hasLexicalTables = (value) => hasNodeType(value, 'table');
export const hasLexicalCallouts = (value) => hasNodeType(value, 'callout');

// Only these serialized values may reach CSS in the public renderer.
export function richTextAlignment(format) {
    return ['left', 'center', 'right', 'justify', 'start', 'end'].includes(format) ? format : null;
}

function validTable(node) {
    if (!node.children.length || node.children.length > 10000) return false;
    const occupied = [];
    let width;
    for (const [rowIndex, row] of node.children.entries()) {
        if (!row.children.length) return false;
        let column = 0;
        for (const cell of row.children) {
            while (occupied[column] > rowIndex) column++;
            if (cell.rowSpan > node.children.length - rowIndex || column + cell.colSpan > 1000) return false;
            for (let offset = 0; offset < cell.colSpan; offset++) {
                if (occupied[column + offset] > rowIndex) return false;
                occupied[column + offset] = rowIndex + cell.rowSpan;
            }
            column += cell.colSpan;
        }
        while (occupied[column] > rowIndex) column++;
        if (width === undefined) width = column;
        else if (column !== width) return false;
    }
    return node.colWidths === undefined || (Array.isArray(node.colWidths)
        && node.colWidths.length === width && node.colWidths.every((width) => Number.isFinite(width) && width > 0));
}

export function isSupportedLexicalDocument(value, variant = 'full') {
    function valid(node, types, depth) {
        if (depth > 512 || !node || typeof node !== 'object' || Array.isArray(node)
            || !types.includes(node.type) || node.version !== 1) return false;
        const children = childrenByType[node.type];
        if (children) {
            if (!Array.isArray(node.children) || ![null, undefined, 'ltr', 'rtl'].includes(node.direction)
                || (node.format !== undefined && typeof node.format !== 'string')
                || (node.indent !== undefined && !Number.isInteger(node.indent))) return false;
            if (node.type === 'heading' && !/^h[1-6]$/.test(node.tag)) return false;
            if (node.type === 'callout' && variant !== 'full') return false;
            if (['link', 'autolink'].includes(node.type) && typeof node.url !== 'string') return false;
            if (node.type === 'list' && (!['bullet', 'number', 'check'].includes(node.listType)
                || node.tag !== (node.listType === 'number' ? 'ol' : 'ul') || !Number.isFinite(node.start))) return false;
            if (node.type === 'listitem' && !Number.isFinite(node.value)) return false;
            if (node.type === 'table' && (variant !== 'full'
                || (node.rowStriping !== undefined && typeof node.rowStriping !== 'boolean')
                || ['frozenColumnCount', 'frozenRowCount'].some((key) => node[key] !== undefined && (!Number.isInteger(node[key]) || node[key] < 0)))) return false;
            if (node.type === 'tablecell' && (!node.children.length
                || !Number.isInteger(node.headerState) || node.headerState < 0 || node.headerState > 3
                || !Number.isInteger(node.colSpan) || node.colSpan < 1
                || !Number.isInteger(node.rowSpan) || node.rowSpan < 1
                || (node.backgroundColor !== undefined && node.backgroundColor !== null && typeof node.backgroundColor !== 'string')
                || (node.width !== undefined && (!Number.isFinite(node.width) || node.width <= 0)))) return false;
            if (node.type === 'tablerow' && node.height !== undefined && (!Number.isFinite(node.height) || node.height <= 0)) return false;
            return node.children.every((child) => valid(child, children, depth + 1))
                && (node.type !== 'table' || validTable(node));
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
    if (node.type === 'horizontalrule' || node.type === 'table') return true;
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
