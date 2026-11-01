import { createElement, Fragment } from 'react';

function isSafeLink(value) {
    if (typeof value !== 'string' || !value.trim()) return false;
    try {
        const url = new URL(value, 'https://kroy.invalid');
        if (url.origin === 'https://kroy.invalid') return !value.trim().startsWith('//');
        return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol);
    } catch {
        return false;
    }
}

function renderText(node, key) {
    let text = node.text ?? '';
    const format = Number(node.format) || 0;
    if (format & 1) text = createElement('strong', { key: `${key}-bold` }, text);
    if (format & 2) text = createElement('em', { key: `${key}-italic` }, text);
    if (format & 8) text = createElement('u', { key: `${key}-underline` }, text);
    return text;
}

function renderChildren(node) {
    if (!Array.isArray(node.children)) return null;
    return node.children.map((child, index) => renderLexicalNode(child, `${node.type}-${index}`));
}

export function renderLexicalNode(node, key = 'node') {
    if (!node || typeof node !== 'object') return null;
    if (node.type === 'text') return renderText(node, key);
    if (node.type === 'linebreak') return createElement('br', { key });

    const children = renderChildren(node);
    switch (node.type) {
        case 'root':
            return createElement(Fragment, { key }, children);
        case 'paragraph':
            return createElement('p', { key }, children);
        case 'heading':
            return createElement(node.tag === 'h3' ? 'h3' : 'h2', { key }, children);
        case 'list':
            return createElement(node.listType === 'number' ? 'ol' : 'ul', { key }, children);
        case 'listitem':
            return createElement('li', { key }, children);
        case 'link':
        case 'autolink':
            if (!isSafeLink(node.url)) return createElement(Fragment, { key }, children);
            return createElement('a', {
                key,
                href: node.url,
                ...(node.target === '_blank' ? { target: '_blank', rel: 'noopener noreferrer' } : {}),
            }, children);
        default:
            return node.text !== undefined
                ? createElement(Fragment, { key }, node.text, children)
                : createElement(Fragment, { key }, children);
    }
}

export function renderLexicalContent(value) {
    return renderLexicalNode(value?.root ?? value);
}
