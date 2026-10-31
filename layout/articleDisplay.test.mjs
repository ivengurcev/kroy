import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { createArticleDisplay } from './articleDisplay.mjs';

test('renders the current article title, cover, and Lexical content on the server', () => {
    const html = renderToStaticMarkup(createArticleDisplay({
        title: 'Server rendered article',
        coverUrl: '/assets/articles/cover.webp',
        content: {
            root: {
                type: 'root',
                children: [{ type: 'paragraph', children: [{ type: 'text', text: 'Full article text' }] }],
            },
        },
    }));

    assert.match(html, /<h1[^>]*>Server rendered article<\/h1>/);
    assert.match(html, /<img[^>]*src="\/assets\/articles\/cover\.webp"[^>]*alt="Server rendered article"/);
    assert.match(html, /<p>Full article text<\/p>/);
});

test('returns no markup when the article record is absent', () => {
    assert.equal(createArticleDisplay(null), null);
});
