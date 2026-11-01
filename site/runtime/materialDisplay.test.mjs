import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { createMaterialDisplay } from './materialDisplay.mjs';

test('renders a material title, cover, and Lexical content on the server', () => {
    const html = renderToStaticMarkup(createMaterialDisplay({
        title: 'Server rendered material', coverUrl: '/assets/materials/cover.webp',
        content: { root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text: 'Full material text' }] }] } },
    }));
    assert.match(html, /<h1[^>]*>Server rendered material<\/h1>/);
    assert.match(html, /src="\/assets\/materials\/cover\.webp"/);
    assert.match(html, /<p>Full material text<\/p>/);
});

test('returns no markup when the material record is absent', () => assert.equal(createMaterialDisplay(null), null));
