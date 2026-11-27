import assert from 'node:assert/strict';
import test from 'node:test';
import { $createParagraphNode, $createTextNode, $getRoot, $getSelection, $setSelection, createEditor, FORMAT_TEXT_COMMAND } from 'lexical';
import { registerRichText } from '@lexical/rich-text';
import { $createListItemNode, $createListNode, registerList } from '@lexical/list';
import { INSERT_TABLE_COMMAND } from '@lexical/table';
import { getRichTextNodes, registerFullTableTransforms } from '../../shared/lexicalEditor.mjs';
import { $readToolbarState, $toggleBlock, $toggleList } from './richTextToolbar.mjs';

function setup(t) {
    const editor = createEditor({ nodes: getRichTextNodes('full'), onError: (error) => { throw error; } });
    t.after(registerRichText(editor));
    t.after(registerList(editor));
    t.after(registerFullTableTransforms(editor));
    return editor;
}

test('toolbar tracks caret-only selection changes and native text/heading toggles', (t) => {
    const editor = setup(t);
    const states = [];
    t.after(editor.registerUpdateListener(({ editorState }) => editorState.read(() => states.push($readToolbarState()))));
    const update = (callback) => editor.update(callback, { discrete: true });
    function placeCaret(node) {
        const range = node.select(1, 1);
        // DOM selection reconciliation supplies the text format in a mounted
        // editor; this headless test supplies the same native RangeSelection.
        range.setFormat(node.getFormat());
    }
    update(() => {
        $getRoot().append(
            $createParagraphNode().append($createTextNode('Bold').toggleFormat('bold')),
            $createParagraphNode().append($createTextNode('Plain')),
        );
        placeCaret($getRoot().getFirstDescendant());
    });
    assert.equal(states.at(-1).bold, true);
    const original = editor.getEditorState().toJSON();
    update(() => placeCaret($getRoot().getLastDescendant()));
    assert.equal(states.at(-1).bold, false);
    assert.deepEqual(editor.getEditorState().toJSON(), original, 'moving the caret must not edit the document');
    for (const format of ['bold', 'italic', 'underline']) {
        update(() => $getRoot().getLastChild().select(0, 1));
        update(() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, format));
        assert.equal(states.at(-1)[format], true);
        update(() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, format));
        assert.equal(states.at(-1)[format], false);
    }
    update(() => $toggleBlock('h2'));
    assert.equal(states.at(-1).block, 'h2');
    update(() => $toggleBlock('h3'));
    assert.equal(states.at(-1).block, 'h3');
    update(() => $toggleBlock('h3'));
    assert.equal(states.at(-1).block, 'paragraph');
});

test('native list commands toggle multiple selected paragraphs and nested list types', (t) => {
    const editor = setup(t);
    const update = (callback) => editor.update(callback, { discrete: true });
    update(() => {
        const root = $getRoot();
        root.append($createParagraphNode().append($createTextNode('One')), $createParagraphNode().append($createTextNode('Two')));
        root.getFirstDescendant().select(0);
        $getSelection().focus.set(root.getLastDescendant().getKey(), 3, 'text');
        $toggleList(editor, 'bullet');
    });
    let value = editor.getEditorState().toJSON();
    assert.equal(value.root.children[0].listType, 'bullet');
    assert.equal(value.root.children[0].children.length, 2);
    update(() => $toggleList(editor, 'number'));
    assert.equal(editor.getEditorState().toJSON().root.children[0].listType, 'number');
    update(() => $toggleList(editor, 'number'));
    assert.deepEqual(editor.getEditorState().toJSON().root.children.map((node) => node.type), ['paragraph', 'paragraph']);
    update(() => {
        const nested = $createListNode('bullet').append($createListItemNode().append($createTextNode('Nested')));
        $getRoot().clear().append($createListNode('bullet').append(
            $createListItemNode().append($createTextNode('Parent')),
            $createListItemNode().append(nested),
        ));
        nested.getFirstDescendant().select();
        assert.equal($readToolbarState().list, 'bullet');
        $toggleList(editor, 'number');
    });
    editor.getEditorState().read(() => assert.equal($readToolbarState().list, 'number'));
    update(() => $toggleList(editor, 'number'));
    editor.getEditorState().read(() => assert.equal($readToolbarState().list, null));
});

test('table context comes from the current selection, including another table or a plain paragraph', (t) => {
    const editor = setup(t);
    const update = (callback) => editor.update(callback, { discrete: true });
    update(() => {
        $getRoot().append($createParagraphNode()).selectEnd();
        editor.dispatchCommand(INSERT_TABLE_COMMAND, { rows: '2', columns: '6', includeHeaders: false });
    });
    let first;
    editor.getEditorState().read(() => { first = $readToolbarState().table.key; });
    update(() => {
        $getRoot().append($createParagraphNode()).selectEnd();
        assert.equal($readToolbarState().table, null);
        editor.dispatchCommand(INSERT_TABLE_COMMAND, { rows: '1', columns: '1', includeHeaders: true });
        assert.notEqual($readToolbarState().table.key, first);
        assert.equal($readToolbarState().table.row, true);
    });
    let saved;
    update(() => { saved = $getSelection().clone(); $setSelection(null); });
    update(() => {
        $setSelection(saved.clone());
        assert.notEqual($readToolbarState().table.key, first);
        $getRoot().getChildren().find((node) => node.getKey() === first).getFirstDescendant().selectStart();
        assert.equal($readToolbarState().table.key, first);
        assert.equal($readToolbarState().table.row, false);
    });
});
