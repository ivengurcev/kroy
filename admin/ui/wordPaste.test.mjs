import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { $createParagraphNode, $getRoot, $getSelection, createEditor, HISTORY_PUSH_TAG, PASTE_COMMAND, UNDO_COMMAND } from 'lexical';
import { registerRichText } from '@lexical/rich-text';
import { registerNodeStructure } from '@lexical/extension';
import { createEmptyHistoryState, registerHistory } from '@lexical/history';
import { RICH_TEXT_HTML, RICH_TEXT_NODES, normalizeLexicalDocument, repairDocumentText } from '../../shared/lexicalEditor.mjs';
import { isDocumentText, legalDocumentBlock } from '../../shared/legalDocuments.mjs';
import { validateDocumentContent } from '../../shared/pageTemplates.mjs';
import { renderLexicalContent } from '../../site/runtime/lexicalContent.mjs';
import { repairRichTextValue, richTextValueKey, syncRichTextValue, toLexicalDocument } from './richTextState.mjs';
import regression from './fixtures/nested-rich-text.mjs';

function leaves(value) {
    const result = [];
    function visit(node) {
        if (typeof node.text === 'string') result.push({ text: node.text, format: node.format ?? 0 });
        for (const child of node.children ?? []) visit(child);
    }
    visit(value.root);
    return result;
}

function markup(value) {
    return renderToStaticMarkup(createElement('div', null, renderLexicalContent(value)));
}

function validHtml(html) {
    const dom = new JSDOM(html);
    try {
        assert.equal(dom.window.document.querySelectorAll('p h1, p h2, p h3, p p, p ul, p ol, h1 p, h2 p, h3 p, a a, ul > ul, ol > ul, ol > ol, ul > ol').length, 0);
        // A browser parser repairs invalid <p><h2>...; compare the parsed body too.
        assert.equal(dom.window.document.body.innerHTML, html);
    } finally { dom.window.close(); }
}

test('old and unsaved nested Lexical documents repair without changing text or marks', () => {
    const original = structuredClone(regression);
    const repaired = normalizeLexicalDocument(regression);
    assert.equal(isDocumentText(regression), false);
    assert.equal(isDocumentText(repaired), true);
    assert.deepEqual(leaves(repaired), leaves(regression));
    assert.deepEqual(regression, original);
    assert.equal(normalizeLexicalDocument(repaired), repaired);
    const emitted = [];
    const tracker = { incoming: richTextValueKey(regression), emitted: null };
    assert.equal(repairRichTextValue(regression, repaired, tracker, (value) => emitted.push(value)), true);
    assert.deepEqual(emitted, [repaired]);
    const editor = createEditor({ nodes: RICH_TEXT_NODES, onError: (error) => { throw error; } });
    editor.setEditorState(editor.parseEditorState(repaired));
    assert.equal(syncRichTextValue(editor, repaired, tracker), false, 'the parent echo must not reset selection/history');
    validHtml(markup(repaired));
    validHtml(markup(regression));
    assert.match(markup(regression), /<h2><u><em><strong>Условия договора/);
    assert.match(markup(repaired), /href="\/contacts"/);
    const catalog = { '@kroy/document': { contract: 'document' } };
    const invalid = validateDocumentContent([legalDocumentBlock(regression)], catalog, catalog, { isLegalDocument: true });
    assert.equal(invalid.length, 1);
    assert.equal(invalid[0].code, 'invalid_lexical');
    assert.deepEqual(validateDocumentContent([legalDocumentBlock(repaired)], catalog, catalog, { isLegalDocument: true }), []);
    const malformedBlock = { ...legalDocumentBlock(repaired), props: null };
    assert.equal(validateDocumentContent([malformedBlock], catalog, catalog, { isLegalDocument: true }).length, 1);
    const headingInLink = structuredClone(regression);
    headingInLink.root.children = [{
        type: 'link', version: 1, url: 'https://example.org/nested',
        children: [regression.root.children[0].children[1]],
    }];
    const linked = normalizeLexicalDocument(headingInLink);
    assert.match(markup(linked), /<h2><a href="https:\/\/example.org\/nested">/);
    validHtml(markup(headingInLink));
    const unknown = { root: { type: 'root', version: 1, children: [{ type: 'unsupported', children: [{ type: 'text', text: 'Do not lose me' }] }] } };
    assert.equal(repairDocumentText(unknown), unknown, 'unrepairable values remain available, not replaced by empty text');
});

test('native Word HTML paste normalizes before editing and retains headings, lists, marks and links', async (t) => {
    const dom = new JSDOM('<!doctype html><html><body></body></html>');
    const globals = { window: dom.window, document: dom.window.document, DOMParser: dom.window.DOMParser,
        HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, InputEvent: dom.window.InputEvent, KeyboardEvent: dom.window.KeyboardEvent,
        DragEvent: dom.window.DragEvent ?? class DragEvent extends dom.window.Event {},
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
    const editor = createEditor({ nodes: RICH_TEXT_NODES, html: RICH_TEXT_HTML, onError: (error) => { throw error; } });
    t.after(registerNodeStructure(editor));
    t.after(registerRichText(editor));
    const history = createEmptyHistoryState();
    t.after(registerHistory(editor, history, 300));
    editor.update(() => { $getRoot().append($createParagraphNode()).selectEnd(); }, { discrete: true });
    const html = await readFile(new URL('./fixtures/word-paste.html', import.meta.url), 'utf8');
    function pasteEvent(source) {
        const event = new globalThis.ClipboardEvent('paste', { cancelable: true });
        Object.defineProperty(event, 'clipboardData', { value: {
            files: [], types: ['text/html', 'text/plain'],
            getData: (type) => type === 'text/html' ? source : '',
        } });
        return event;
    }
    const event = pasteEvent(html);
    editor.update(() => { assert.equal(editor.dispatchCommand(PASTE_COMMAND, event), true); }, { discrete: true });
    assert.equal(event.defaultPrevented, true);
    const pasted = editor.getEditorState().toJSON();
    assert.equal(isDocumentText(pasted), true);
    const output = markup(pasted);
    validHtml(output);
    assert.match(output, /<h1><u><em><strong>Договор оказания услуг/);
    assert.match(output, /<h2><u><em><strong>Права и обязанности/);
    assert.match(output, /<ol start="3">/);
    assert.match(output, /<ul>/);
    assert.match(output, /<ol start="2">/);
    assert.match(output, /href="https:\/\/example.org\/terms"/);
    assert.match(output, /href="\/contacts"/);
    assert.match(output, /<u><em><strong>Завершающий форматированный текст/);
    editor.update(() => { $getRoot().getLastDescendant().selectEnd(); $getSelection().insertText(' Отредактировано'); }, { discrete: true, tag: HISTORY_PUSH_TAG });
    const edited = editor.getEditorState().toJSON();
    assert.equal(isDocumentText(edited), true);
    assert.match(markup(edited), /Отредактировано/);
    editor.update(() => { editor.dispatchCommand(UNDO_COMMAND, undefined); }, { discrete: true });
    assert.equal(markup(editor.getEditorState().toJSON()), output);
    const reopened = createEditor({ nodes: RICH_TEXT_NODES, onError: (error) => { throw error; } });
    reopened.setEditorState(reopened.parseEditorState(toLexicalDocument(JSON.parse(JSON.stringify(edited)))));
    assert.equal(markup(reopened.getEditorState().toJSON()), markup(edited));
    const body = new dom.window.DOMParser().parseFromString(html, 'text/html').body.innerHTML;
    const longHtml = Array.from({ length: 100 }, (_, index) => `<p>Раздел ${index}</p>${body}`).join('');
    editor.update(() => {
        $getRoot().clear().append($createParagraphNode()).selectEnd();
        editor.dispatchCommand(PASTE_COMMAND, pasteEvent(longHtml));
    }, { discrete: true });
    const longDocument = editor.getEditorState().toJSON();
    assert.equal(isDocumentText(longDocument), true);
    const allText = leaves(longDocument).map(({ text }) => text).join('');
    assert.equal(allText.match(/Договор оказания услуг/g).length, 100);
    assert.match(allText, /Раздел 99/);
    assert.equal(markup(toLexicalDocument(JSON.parse(JSON.stringify(longDocument)))), markup(longDocument));
});

test('long nested documents retain every character through repair, JSON save and reopen', () => {
    const document = { root: { ...regression.root, children: Array.from({ length: 250 }, () => structuredClone(regression.root.children)).flat() } };
    const normalized = normalizeLexicalDocument(document);
    assert.equal(isDocumentText(normalized), true);
    assert.deepEqual(leaves(normalized), leaves(document));
    const reopened = toLexicalDocument(JSON.parse(JSON.stringify(normalized)));
    assert.equal(markup(reopened), markup(normalized));
    assert.equal(leaves(reopened).length, 250 * leaves(regression).length);
});
