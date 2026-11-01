import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { renderLexicalContent } from './lexicalContent.mjs';

function markup(value) {
    return renderToStaticMarkup(createElement('div', null, renderLexicalContent(value)));
}

test('renders article text marks, headings, paragraphs, and lists as HTML', () => {
    const html = markup({
        root: {
            type: 'root',
            children: [
                { type: 'heading', tag: 'h2', children: [{ type: 'text', text: 'Heading', format: 1 }] },
                { type: 'paragraph', children: [{ type: 'text', text: 'Body', format: 2 | 8 }] },
                { type: 'list', listType: 'bullet', children: [{ type: 'listitem', children: [{ type: 'text', text: 'Item' }] }] },
            ],
        },
    });

    assert.match(html, /<h2><strong>Heading<\/strong><\/h2>/);
    assert.match(html, /<p><u><em>Body<\/em><\/u><\/p>/);
    assert.match(html, /<ul><li>Item<\/li><\/ul>/);
});

test('renders safe links and unwraps unsafe links without losing text', () => {
    const safe = markup({ root: { type: 'root', children: [{ type: 'link', url: 'https://example.com', children: [{ type: 'text', text: 'Safe' }] }] } });
    const mail = markup({ root: { type: 'root', children: [{ type: 'link', url: 'mailto:hello@example.com', children: [{ type: 'text', text: 'Mail' }] }] } });
    const unsafe = markup({ root: { type: 'root', children: [{ type: 'link', url: 'javascript:alert(1)', children: [{ type: 'text', text: 'Visible' }] }] } });

    assert.match(safe, /<a href="https:\/\/example\.com">Safe<\/a>/);
    assert.match(mail, /<a href="mailto:hello@example\.com">Mail<\/a>/);
    assert.doesNotMatch(unsafe, /href=/);
    assert.match(unsafe, /Visible/);
});

test('unknown Lexical nodes preserve descendant text', () => {
    const html = markup({ root: { type: 'root', children: [{ type: 'future-node', children: [{ type: 'text', text: 'Readable' }] }] } });
    assert.match(html, /Readable/);
});
