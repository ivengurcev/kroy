import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { renderLexicalContent } from './lexicalContent.mjs';

function markup(value) {
    return renderToStaticMarkup(createElement('div', null, renderLexicalContent(value)));
}

test('renders material text marks, headings, paragraphs, and lists as HTML', () => {
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

test('legacy strings remain escaped text with historical paragraph breaks', () => {
    assert.equal(markup(' Первый\r\n\r\nВторой <b>не HTML</b> '), '<div><p>Первый</p><p>Второй &lt;b&gt;не HTML&lt;/b&gt;</p></div>');
});

test('empty documents and empty blocks do not create public markup', () => {
    for (const value of [null, undefined, '', { root: { type: 'root', children: [] } }, {
        root: { type: 'root', children: [
            { type: 'paragraph', children: [{ type: 'text', text: '  ' }] },
            { type: 'heading', tag: 'h2', children: [] },
            { type: 'list', children: [{ type: 'listitem', children: [] }] },
        ] },
    }]) assert.equal(markup(value), '<div></div>');
});

test('renders H3, ordered lists and internal links; rejects executable URLs', () => {
    const text = { type: 'text', text: 'Содержимое' };
    const html = markup({ root: { type: 'root', children: [
        { type: 'heading', tag: 'h3', children: [text] },
        { type: 'list', listType: 'number', children: [{ type: 'listitem', children: [text] }] },
        ...['/inside', '#anchor', 'https://example.com', 'javascript:alert(1)', 'data:text/html,hello'].map((url) => ({ type: 'link', url, children: [text] })),
    ] } });
    assert.match(html, /<h3>Содержимое<\/h3><ol><li>Содержимое<\/li><\/ol>/);
    assert.match(html, /href="\/inside"/);
    assert.match(html, /href="#anchor"/);
    assert.doesNotMatch(html, /href="(?:javascript:|data:)/);
});

test('renders explicitly inserted horizontal rules as safe standalone hr elements', () => {
    assert.equal(markup({ root: { type: 'root', children: [{ type: 'horizontalrule', version: 1 }] } }), '<div><hr/></div>');
});
