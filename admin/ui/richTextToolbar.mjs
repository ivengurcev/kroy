import { $createParagraphNode, $getSelection, $isRangeSelection } from 'lexical';
import { $createHeadingNode, $isHeadingNode } from '@lexical/rich-text';
import { $isListNode, INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND, REMOVE_LIST_COMMAND } from '@lexical/list';
import { $isLinkNode } from '@lexical/link';
import { $isTableSelection } from '@lexical/table';
import { $setBlocksType } from '@lexical/selection';
import { $selectedTable, $tableHeaders } from './richTextTables.mjs';

export function $readToolbarState() {
    const selection = $getSelection();
    const valid = $isRangeSelection(selection) || $isTableSelection(selection);
    let block = 'paragraph';
    let list = null;
    let link = false;
    if (valid) {
        for (let node = selection.anchor.getNode(); node; node = node.getParent()) {
            if ($isHeadingNode(node)) block = node.getTag();
            if ($isListNode(node) && !list) list = node.getListType();
            if ($isLinkNode(node)) link = true;
        }
    }
    const table = valid ? $selectedTable() : null;
    return {
        bold: valid && selection.hasFormat('bold'),
        italic: valid && selection.hasFormat('italic'),
        underline: valid && selection.hasFormat('underline'),
        block, list, link,
        table: table ? { key: table.getKey(), ...$tableHeaders(table) } : null,
    };
}

export function $toggleList(editor, type) {
    editor.dispatchCommand($readToolbarState().list === type ? REMOVE_LIST_COMMAND
        : type === 'bullet' ? INSERT_UNORDERED_LIST_COMMAND : INSERT_ORDERED_LIST_COMMAND, undefined);
}

export function $toggleBlock(type) {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return;
    const next = $readToolbarState().block === type ? 'paragraph' : type;
    $setBlocksType(selection, () => next === 'paragraph' ? $createParagraphNode() : $createHeadingNode(next));
}
