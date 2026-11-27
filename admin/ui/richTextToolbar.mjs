import { $addUpdateTag, $createParagraphNode, $getSelection, $isElementNode, $isRangeSelection, HISTORY_PUSH_TAG } from 'lexical';
import { $createHeadingNode, $isHeadingNode } from '@lexical/rich-text';
import { $isListNode, INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND, REMOVE_LIST_COMMAND } from '@lexical/list';
import { $isLinkNode } from '@lexical/link';
import { $isTableSelection } from '@lexical/table';
import { $setBlocksType } from '@lexical/selection';
import { $selectedTable, $tableHeaders } from './richTextTables.mjs';
import { $createCalloutNode, $getTextBlock } from '../../shared/lexicalCallout.mjs';
import { richTextAlignment } from '../../shared/richText.mjs';

export function $readToolbarState() {
    const selection = $getSelection();
    const valid = $isRangeSelection(selection) || $isTableSelection(selection);
    let block = 'paragraph';
    let list = null;
    let link = false;
    let alignment = 'left';
    let callout = false;
    let canCallout = false;
    if (valid) {
        const textBlock = $getTextBlock(selection.anchor.getNode());
        callout = textBlock?.getType() === 'callout';
        if (callout) block = 'callout';
        canCallout = $isRangeSelection(selection) && ['paragraph', 'callout'].includes(textBlock?.getType())
            && $getTextBlock(selection.focus.getNode())?.is(textBlock) === true;
        for (let node = selection.anchor.getNode(); node; node = node.getParent()) {
            if ($isElementNode(node) && !node.isInline()) {
                const format = richTextAlignment(node.getFormatType());
                alignment = format === 'start' || format === 'end'
                    ? ((node.getDirection() === 'rtl') === (format === 'start') ? 'right' : 'left')
                    : format ?? 'left';
                break;
            }
        }
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
        block, list, link, alignment, callout, canCallout, canAlign: $isRangeSelection(selection),
        table: table ? { key: table.getKey(), ...$tableHeaders(table) } : null,
    };
}

export function $toggleCallout() {
    const selection = $getSelection();
    if (!$isRangeSelection(selection) || !$readToolbarState().canCallout) return;
    const block = $getTextBlock(selection.anchor.getNode());
    const replacement = block.getType() === 'callout' ? $createParagraphNode() : $createCalloutNode();
    replacement.setFormat(block.getFormatType()).setDirection(block.getDirection()).setIndent(block.getIndent())
        .setTextFormat(block.getTextFormat()).setTextStyle(block.getTextStyle()).setStyle(block.getStyle());
    block.replace(replacement, true);
    $addUpdateTag(HISTORY_PUSH_TAG);
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
