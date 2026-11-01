import { createElement } from 'react';
import { renderLexicalContent } from './lexicalContent.mjs';

export function createArticleDisplay(record, styles = {}) {
    if (!record) return null;

    return createElement('article', { className: styles.article },
        createElement('h1', { className: styles.title }, record.title),
        record.coverUrl && createElement('img', {
            className: styles.cover,
            src: record.coverUrl,
            alt: record.title ?? '',
        }),
        createElement('div', { className: styles.content }, renderLexicalContent(record.content)),
    );
}
