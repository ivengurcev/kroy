import { isPlainObject, isValidPagePath } from './pageFields.mjs';

export const LEGAL_DOCUMENT_PART = '@kroy/document';
export const LEGAL_CONTENT_ERROR = 'Содержимое должно быть одним блоком «Правовой документ» с корректным форматированным текстом.';

export function isLegalPagePath(path) {
    return isValidPagePath(path) && !/^\/(?:auth|assets)(?:\/|$)/.test(path);
}

// Match the node types registered by RichTextEditor, including built-in text nodes.
const inline = ['text', 'tab', 'linebreak'];
const block = ['paragraph', 'heading', 'list', 'horizontalrule'];
const childrenByType = {
    root: block,
    paragraph: [...inline, 'link'],
    heading: [...inline, 'link'],
    link: inline,
    list: ['listitem'],
    listitem: [...inline, 'link', ...block],
};

function validNode(node, types, depth) {
    if (depth > 100 || !isPlainObject(node) || !types.includes(node.type) || node.version !== 1) return false;
    const children = childrenByType[node.type];
    if (children) {
        if (!Array.isArray(node.children)
            || ![null, undefined, 'ltr', 'rtl'].includes(node.direction)
            || (node.format !== undefined && typeof node.format !== 'string')
            || (node.indent !== undefined && !Number.isInteger(node.indent))) return false;
        if (node.type === 'heading' && !/^h[1-6]$/.test(node.tag)) return false;
        if (node.type === 'link' && typeof node.url !== 'string') return false;
        if (node.type === 'list' && (!['bullet', 'number', 'check'].includes(node.listType)
            || !['ul', 'ol'].includes(node.tag) || !Number.isInteger(node.start))) return false;
        if (node.type === 'listitem' && !Number.isInteger(node.value)) return false;
        return node.children.every((child) => validNode(child, children, depth + 1));
    }
    if (Object.hasOwn(node, 'children')) return false;
    return !['text', 'tab'].includes(node.type) || (typeof node.text === 'string'
        && Number.isInteger(node.format) && Number.isInteger(node.detail)
        && typeof node.style === 'string' && ['normal', 'token', 'segmented'].includes(node.mode));
}

export function isDocumentText(value) {
    return isPlainObject(value) && validNode(value.root, ['root'], 0);
}

export function legalDocumentBlock(content, viewProps = {}) {
    return { part: LEGAL_DOCUMENT_PART, props: { content }, view: { name: LEGAL_DOCUMENT_PART, props: viewProps } };
}

export function isLegalDocumentContent(content) {
    return Array.isArray(content) && content.length === 1
        && content[0]?.part === LEGAL_DOCUMENT_PART
        && content[0].view?.name === LEGAL_DOCUMENT_PART
        && isDocumentText(content[0].props?.content);
}
