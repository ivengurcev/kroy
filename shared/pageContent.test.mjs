import assert from 'node:assert/strict';
import test from 'node:test';
import { isValidContent } from './pageContent.mjs';

const parts = { '@kroy/reviews': { contract: 'reviews' } };
const widgets = { '@kroy/cards': { contract: 'reviews' }, '@kroy/material-content': { contract: 'material' } };
const item = { part: '@kroy/reviews', props: { reviewIds: ['a'] }, view: { name: '@kroy/cards', props: { columns: 3 } } };

test('requires the exact part/props/view shape and a known compatible widget', () => {
    assert.equal(isValidContent([item], parts, widgets), true);
    assert.equal(isValidContent([], parts, widgets), true);
    for (const invalid of [
        { part: item.part, props: {} }, { ...item, id: 'editor-only' }, { ...item, part: '@kroy/missing' },
        { ...item, props: null }, { ...item, view: null }, { ...item, view: { name: '@kroy/cards' } },
        { ...item, view: { name: '@kroy/missing', props: {} } },
        { ...item, view: { name: '@kroy/material-content', props: {} } },
        { ...item, view: { ...item.view, props: [] } },
    ]) assert.equal(isValidContent([invalid], parts, widgets), false);
    assert.equal(isValidContent([item], { '@kroy/reviews': {} }, { '@kroy/cards': {} }), false);
});

test('part props can keep either historical strings or nested Lexical JSON without conversion', () => {
    const document = { root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text: 'Форматирование', format: 1 }] }] } };
    for (const text of ['Старый текст', document]) {
        const content = [{ ...item, props: { text, rows: [{ description: text, note: text }] } }];
        const snapshot = JSON.stringify(content);
        assert.equal(isValidContent(content, parts, widgets), true);
        assert.equal(JSON.stringify(content), snapshot);
        assert.deepEqual(JSON.parse(snapshot)[0].props.text, text);
    }
});
