import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { $createParagraphNode, $getRoot, $getSelection, createEditor, PASTE_COMMAND } from 'lexical';
import { registerRichText } from '@lexical/rich-text';
import { registerNodeStructure } from '@lexical/extension';
import { INSERT_TABLE_COMMAND } from '@lexical/table';
import { getRichTextNodes, getRichTextHtml, normalizeLexicalDocument, registerFullTableTransforms } from '../../shared/lexicalEditor.mjs';
import { hasLexicalTables, isSupportedLexicalDocument } from '../../shared/richText.mjs';
import { isDocumentText, legalDocumentBlock } from '../../shared/legalDocuments.mjs';
import { validateDocumentContent } from '../../shared/pageTemplates.mjs';
import { renderLexicalContent } from '../../site/runtime/lexicalContent.mjs';
import { toLexicalDocument } from './richTextState.mjs';
import { $applyTableAction } from './richTextTables.mjs';

function setup(t, variant) {
    const editor = createEditor({ nodes: getRichTextNodes(variant), html: getRichTextHtml(variant), onError: (error) => { throw error; } });
    t.after(registerNodeStructure(editor));
    t.after(registerRichText(editor));
    if (variant === 'full') t.after(registerFullTableTransforms(editor));
    editor.update(() => { $getRoot().append($createParagraphNode()).selectEnd(); }, { discrete: true });
    return editor;
}
const json = (editor) => editor.getEditorState().toJSON();
const markup = (value) => renderToStaticMarkup(createElement('div', null, renderLexicalContent(value)));
function text(node) { return (node.text ?? '') + (node.children ?? []).map(text).join(''); }
function paste(editor, html) {
    const event = new ClipboardEvent('paste', { cancelable: true });
    Object.defineProperty(event, 'clipboardData', { value: {
        files: [], types: ['text/html', 'text/plain'], getData: (type) => type === 'text/html' ? html : '',
    } });
    editor.update(() => { assert.equal(editor.dispatchCommand(PASTE_COMMAND, event), true); }, { discrete: true });
    assert.equal(event.defaultPrevented, true);
}

test('full creates and edits a 2×6 table with native row/column and header operations', (t) => {
    const editor = setup(t, 'full');
    const update = (callback) => editor.update(callback, { discrete: true });
    update(() => { assert.equal(editor.dispatchCommand(INSERT_TABLE_COMMAND, { rows: '2', columns: '6', includeHeaders: false }), true); });
    const table = () => json(editor).root.children.find((node) => node.type === 'table');
    assert.equal(table().children.length, 2);
    assert.equal(table().children[0].children.length, 6);
    update(() => {
        const cell = $getRoot().getChildren().find((node) => node.getType() === 'table').getFirstChild().getFirstChild();
        cell.selectStart();
        $getSelection().insertText('Edited cell');
    });
    update(() => $applyTableAction('header-column'));
    assert.ok(table().children.every((row) => row.children[0].headerState === 2));
    update(() => $applyTableAction('header-row'));
    assert.equal(table().children[0].children[0].headerState, 3);
    update(() => $applyTableAction('header-row'));
    assert.equal(table().children[0].children[0].headerState, 2);
    for (const action of ['row-before', 'row-after', 'column-before', 'column-after']) update(() => $applyTableAction(action));
    assert.equal(table().children.length, 4);
    assert.equal(table().children[0].children.length, 8);
    update(() => $applyTableAction('delete-row'));
    update(() => $applyTableAction('delete-column'));
    assert.equal(table().children.length, 3);
    assert.equal(table().children[0].children.length, 7);
    assert.match(text(json(editor).root), /Edited cell/);
    assert.equal(isDocumentText(json(editor)), true);
    update(() => $applyTableAction('delete-table'));
    assert.equal(hasLexicalTables(json(editor)), false);
    assert.equal(isDocumentText(json(editor)), true);
});

test('Word clipboard tables preserve order, cells and marks in full; compact imports plain rows only', async (t) => {
    const dom = new JSDOM('<!doctype html><html><body></body></html>');
    const globals = { window: dom.window, document: dom.window.document, DOMParser: dom.window.DOMParser,
        HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, InputEvent: dom.window.InputEvent,
        KeyboardEvent: dom.window.KeyboardEvent, DragEvent: dom.window.DragEvent ?? class DragEvent extends dom.window.Event {},
        ClipboardEvent: dom.window.ClipboardEvent ?? class ClipboardEvent extends dom.window.Event {} };
    const previous = Object.fromEntries(Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    t.after(() => {
        for (const [key, descriptor] of Object.entries(previous)) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor);
            else delete globalThis[key];
        }
        dom.window.close();
    });
    const html = await readFile(new URL('./fixtures/word-table.html', import.meta.url), 'utf8');
    const full = setup(t, 'full');
    paste(full, html);
    const value = json(full);
    assert.equal(isDocumentText(value), true);
    const table = value.root.children.find((node) => node.type === 'table');
    assert.equal(table.children.length, 6);
    assert.ok(table.children.every((row) => row.children.length === 2));
    assert.ok(table.children[0].children.every((cell) => cell.headerState & 1));
    const output = markup(value);
    assert.match(output, /<thead><tr><th scope="col">/);
    assert.match(output, /<strong>Исполнитель<\/strong>/);
    assert.match(output, /<em>Плательщик налога<\/em>/);
    assert.match(output, /<u>290121439010<\/u>/);
    assert.match(output, /href="mailto:tealyona@yandex.ru"/);
    assert.ok(output.indexOf('перед таблицей') < output.indexOf('<table>'));
    assert.ok(output.indexOf('</table>') < output.indexOf('Условия после'));
    const parsed = new JSDOM(output);
    t.after(() => parsed.window.close());
    assert.equal(parsed.window.document.body.innerHTML, output, 'SSR must not need browser nesting repairs');
    assert.equal(parsed.window.document.querySelectorAll('tbody > tr').length, 5);
    assert.equal(parsed.window.document.querySelectorAll('p table, table > tr, tr > p').length, 0);
    const reopened = setup(t, 'full');
    reopened.setEditorState(reopened.parseEditorState(toLexicalDocument(JSON.parse(JSON.stringify(value)), 'full')));
    assert.equal(markup(json(reopened)), output);
    const malformed = structuredClone(value);
    const paragraph = malformed.root.children.find((node) => node.type === 'table').children[1].children[1].children[0];
    paragraph.children = [{ ...structuredClone(paragraph), children: paragraph.children }];
    assert.equal(isDocumentText(malformed), false);
    const repaired = normalizeLexicalDocument(malformed);
    assert.equal(isDocumentText(repaired), true);
    assert.equal(text(repaired.root), text(value.root));
    assert.equal(repaired.root.children.find((node) => node.type === 'table').children.length, 6);
    const catalog = { '@kroy/document': { contract: 'document' } };
    assert.deepEqual(validateDocumentContent([legalDocumentBlock(value)], catalog, catalog, { isLegalDocument: true }), []);
    for (const mutate of [
        (node) => { node.children[0].type = 'paragraph'; },
        (node) => { node.children[0].children[0].headerState = 4; },
        (node) => { node.children[0].children[0].colSpan = 0; },
        (node) => { node.children[0].children[0].rowSpan = 999; },
        (node) => { node.children[0].children.pop(); },
        (node) => { node.children[0].children[0].children = [{ type: 'text', version: 1, text: 'inline' }]; },
    ]) {
        const bad = structuredClone(value);
        mutate(bad.root.children.find((node) => node.type === 'table'));
        assert.equal(isDocumentText(bad), false);
        const errors = validateDocumentContent([legalDocumentBlock(bad)], catalog, catalog, { isLegalDocument: true });
        assert.equal(errors.length, 1);
        assert.equal(errors[0].code, 'invalid_lexical');
    }
    const compact = setup(t, 'compact');
    paste(compact, html);
    const plain = json(compact);
    assert.equal(hasLexicalTables(plain), false);
    assert.equal(isSupportedLexicalDocument(plain, 'compact'), true);
    assert.match(text(plain.root), /Исполнитель\tПутинцева Елена Владимировна/);
    assert.equal(plain.root.children.filter((node) => text(node).includes('\t')).length, 6);
    assert.match(text(plain.root), /Россия/);
    assert.match(text(plain.root), /tealyona@yandex.ru/);
    assert.throws(() => toLexicalDocument(value, 'compact'), /только в полном/);
    assert.equal(compact.hasNodes(getRichTextNodes('full')), false);
    const merged = setup(t, 'full');
    paste(merged, '<p>До</p><table><tr><td colspan="2"><p>Общая ячейка</p></td></tr><tr><td>Левая</td><td>Правая</td></tr></table><p>После</p>');
    const expanded = json(merged);
    assert.equal(isDocumentText(expanded), true);
    const expandedTable = expanded.root.children.find((node) => node.type === 'table');
    assert.ok(expandedTable.children.every((row) => row.children.length === 2 && row.children.every((cell) => cell.colSpan === 1 && cell.rowSpan === 1)));
    assert.match(text(expanded.root), /ДоОбщая ячейкаЛеваяПраваяПосле/);
    const body = new DOMParser().parseFromString(html, 'text/html').body.innerHTML;
    full.update(() => { $getRoot().clear().append($createParagraphNode()).selectEnd(); }, { discrete: true });
    paste(full, Array.from({ length: 80 }, (_, index) => `<p>Раздел ${index}</p>${body}`).join(''));
    const long = json(full);
    assert.equal(isDocumentText(long), true);
    assert.equal(long.root.children.filter((node) => node.type === 'table').length, 80);
    assert.equal(text(long.root).match(/290121439010/g).length, 80);
    assert.match(text(long.root), /Раздел 79/);
    const nested = long.root.children.find((node) => node.type === 'table').children[1].children[1].children[0];
    nested.children = [{ ...structuredClone(nested), children: nested.children }];
    const repairedLong = normalizeLexicalDocument(long);
    assert.equal(isDocumentText(repairedLong), true);
    assert.equal(text(repairedLong.root), text(long.root));
    assert.equal(repairedLong.root.children.filter((node) => node.type === 'table').length, 80);
    assert.equal(markup(toLexicalDocument(JSON.parse(JSON.stringify(long)))), markup(long));
});
