import { createElement, Fragment } from 'react';
import { hasRichText, richTextParagraphs } from '../../shared/richText.mjs';

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
    let text = typeof node.text === 'string' ? node.text : '';
    const format = Number(node.format) || 0;
    if (format & 1) text = createElement('strong', { key: `${key}-bold` }, text);
    if (format & 2) text = createElement('em', { key: `${key}-italic` }, text);
    if (format & 4) text = createElement('s', { key: `${key}-strike` }, text);
    if (format & 8) text = createElement('u', { key: `${key}-underline` }, text);
    if (format & 16) text = createElement('code', { key: `${key}-code` }, text);
    if (format & 32) text = createElement('sub', { key: `${key}-sub` }, text);
    if (format & 64) text = createElement('sup', { key: `${key}-sup` }, text);
    return text;
}

// Read old JSON without an HTML parser or the Lexical engine in the public bundle.
// Split inline containers around blocks; list children always get an li wrapper.
function wrapRuns(children, tag, props = {}) {
    const result = [];
    let run = [];
    function flush() {
        if (run.length) result.push({ kind: tag === 'a' ? 'inline' : 'block', tag, props, children: run });
        run = [];
    }
    for (const child of children) {
        if (tag === 'a' && child.tag === 'a') { flush(); result.push(child); }
        else if (child.kind === 'inline') run.push(child);
        else {
            flush();
            result.push(tag === 'a' ? { ...child, children: wrapRuns(child.children ?? [], tag, props) } : child);
        }
    }
    flush();
    return result;
}

function listItems(children) {
    const result = [];
    let run = [];
    function flush() {
        if (run.length) result.push({ kind: 'item', tag: 'li', children: run });
        run = [];
    }
    for (const child of children) {
        if (child.kind === 'inline') run.push(child);
        else { flush(); result.push(child.kind === 'item' ? child : { kind: 'item', tag: 'li', children: [child] }); }
    }
    flush();
    return result;
}

function wrapOrphanItems(children) {
    const result = [];
    let items = [];
    function flush() {
        if (items.length) result.push({ kind: 'block', tag: 'ul', children: items });
        items = [];
    }
    for (const child of children) {
        if (child.kind === 'item') items.push(child);
        else { flush(); result.push(child); }
    }
    flush();
    return result;
}

function segments(node, depth = 0) {
    if (!node || typeof node !== 'object' || depth > 512) return [];
    if (['text', 'tab'].includes(node.type)) return [{ kind: 'inline', text: renderText(node, 'text') }];
    if (node.type === 'linebreak') return [{ kind: 'inline', tag: 'br' }];
    if (['paragraph', 'heading', 'list', 'listitem'].includes(node.type) && !hasRichText(node)) return [];
    const children = (Array.isArray(node.children) ? node.children : []).flatMap((child) => segments(child, depth + 1));
    switch (node.type) {
        case 'root':
            return wrapRuns(wrapOrphanItems(children), 'p');
        case 'horizontalrule':
            return [{ kind: 'block', tag: 'hr' }];
        case 'paragraph':
            return wrapRuns(wrapOrphanItems(children), 'p');
        case 'heading':
            return wrapRuns(wrapOrphanItems(children), /^h[1-6]$/.test(node.tag) ? node.tag : 'h2');
        case 'list':
            return [{ kind: 'block', tag: node.listType === 'number' ? 'ol' : 'ul',
                props: node.listType === 'number' && Number.isFinite(node.start) && node.start !== 1 ? { start: node.start } : {},
                children: listItems(children) }];
        case 'listitem':
            return [{ kind: 'item', tag: 'li', children: wrapOrphanItems(children) }];
        case 'link':
        case 'autolink':
            if (!isSafeLink(node.url)) return children;
            return wrapRuns(children, 'a', {
                href: node.url,
                ...(node.target === '_blank' ? { target: '_blank', rel: 'noopener noreferrer' } : {}),
            });
        default:
            return typeof node.text === 'string' ? [{ kind: 'inline', text: renderText(node, 'text') }, ...children] : children;
    }
}

function renderSegment(node, key) {
    if (node.text !== undefined) return createElement(Fragment, { key }, node.text);
    const props = { ...node.props, key };
    return node.children ? createElement(node.tag, props, node.children.map((child, index) => renderSegment(child, `${key}-${index}`)))
        : createElement(node.tag, props);
}

export function renderLexicalNode(node, key = 'node') {
    return segments(node).map((segment, index) => renderSegment(segment, `${key}-${index}`));
}

export function renderLexicalContent(value) {
    if (typeof value === 'string') return richTextParagraphs(value).map((paragraph, index) => createElement('p', { key: index }, paragraph));
    return renderLexicalNode(value?.root ?? value);
}
