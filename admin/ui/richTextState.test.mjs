import assert from 'node:assert/strict';
import test from 'node:test';
import { $createParagraphNode, $createTextNode, $getRoot, $getSelection, createEditor, HISTORY_PUSH_TAG, UNDO_COMMAND } from 'lexical';
import { $createHorizontalRuleNode, HorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode';
import { HeadingNode } from '@lexical/rich-text';
import { ListNode, ListItemNode } from '@lexical/list';
import { LinkNode } from '@lexical/link';
import { createEmptyHistoryState, registerHistory } from '@lexical/history';
import { richTextValueKey, syncRichTextValue, toLexicalDocument } from './richTextState.mjs';
import { hasRichText } from '../../shared/richText.mjs';

function editorFor(value) {
    const editor = createEditor({ nodes: [HeadingNode, ListNode, ListItemNode, LinkNode, HorizontalRuleNode], onError: (error) => { throw error; } });
    editor.setEditorState(editor.parseEditorState(toLexicalDocument(value)));
    return editor;
}

test('converts plain strings using Lexical serialization, preserving paragraphs, line breaks and literal HTML', () => {
    const value = ' Первый\r\nвторой\r\n\r\n<b>Не HTML</b>\n\n\nКонец ';
    const document = toLexicalDocument(value);
    assert.equal(document.root.children.length, 3);
    assert.equal(document.root.children[0].children[0].text, ' Первый');
    assert.equal(document.root.children[0].children[1].type, 'linebreak');
    assert.equal(document.root.children[0].children[2].text, 'второй');
    assert.equal(document.root.children[1].children[0].text, '<b>Не HTML</b>');
    assert.equal(document.root.children[2].children[0].type, 'linebreak');
    assert.equal(document.root.children[2].children[1].text, 'Конец ');
    assert.equal(value, ' Первый\r\nвторой\r\n\r\n<b>Не HTML</b>\n\n\nКонец ');
    assert.equal(toLexicalDocument(document), document);
    for (const empty of [null, undefined, '', { root: { type: 'root', children: [] } }]) {
        const next = toLexicalDocument(empty);
        assert.equal(next.root.children[0].type, 'paragraph');
        assert.equal(hasRichText(next), false);
        assert.doesNotThrow(() => editorFor(empty));
    }
});

test('parent echoes retain editor state, selection and undo; external values replace content and clear history', (t) => {
    const editor = editorFor('Текст A');
    const history = createEmptyHistoryState();
    t.after(registerHistory(editor, history, 300));
    const tracker = { incoming: richTextValueKey('Текст A'), emitted: null };
    assert.equal(syncRichTextValue(editor, 'Текст A', tracker), false);
    editor.update(() => { $getRoot().getFirstChild().selectEnd(); }, { discrete: true });
    editor.update(() => { $getSelection().insertText('!'); }, { discrete: true, tag: HISTORY_PUSH_TAG });
    const state = editor.getEditorState();
    const next = state.toJSON();
    tracker.emitted = richTextValueKey(next);
    const undoLength = history.undoStack.length;
    const selection = state.read(() => $getSelection().anchor.offset);
    assert.ok(undoLength > 0);
    assert.equal(syncRichTextValue(editor, structuredClone(next), tracker), false);
    assert.equal(editor.getEditorState(), state);
    assert.equal(state.read(() => $getSelection().anchor.offset), selection);
    assert.equal(history.undoStack.length, undoLength);
    editor.update(() => { editor.dispatchCommand(UNDO_COMMAND, undefined); }, { discrete: true });
    assert.equal(editor.getEditorState().read(() => $getRoot().getTextContent()), 'Текст A');
    assert.equal(syncRichTextValue(editor, 'Текст B', tracker), true);
    assert.equal(editor.getEditorState().read(() => $getRoot().getTextContent()), 'Текст B');
    assert.equal(history.undoStack.length, 0);
    assert.equal(syncRichTextValue(editor, next, tracker), true);
    assert.equal(editor.getEditorState().read(() => $getRoot().getTextContent()), 'Текст A!');
    assert.equal(syncRichTextValue(editor, '', tracker), true);
    assert.equal(editor.getEditorState().read(() => $getRoot().getTextContent()), '');
});

test('horizontal rules survive Lexical serialization, reopening and content normalization', () => {
    const editor = editorFor('До линии');
    editor.update(() => {
        $getRoot().append($createHorizontalRuleNode(), $createParagraphNode().append($createTextNode('После линии')));
    }, { discrete: true });
    const document = editor.getEditorState().toJSON();
    assert.equal(document.root.children[1].type, 'horizontalrule');
    const reopened = editorFor(document).getEditorState().toJSON();
    assert.deepEqual(reopened, document);
    const onlyRule = { root: { ...document.root, children: [document.root.children[1]] } };
    assert.equal(hasRichText(onlyRule), true);
    assert.equal(editorFor(onlyRule).getEditorState().toJSON().root.children[0].type, 'horizontalrule');
});
