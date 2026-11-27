import {
    $addUpdateTag, $createLineBreakNode, $createParagraphNode, $createTextNode, $getSelection,
    $isElementNode, $isRangeSelection, COMMAND_PRIORITY_HIGH, HISTORY_PUSH_TAG, PASTE_COMMAND,
} from 'lexical';
import { $generateNodesFromDOM } from '@lexical/html';
import { $createHeadingNode } from '@lexical/rich-text';
import { $getTextBlock } from '../../shared/lexicalCallout.mjs';

function inlineContent(nodes) {
    return nodes.flatMap((node, index) => {
        if ($isElementNode(node)) {
            const children = inlineContent(node.getChildren());
            if (node.isInline()) return [node.clear().append(...children)];
            return [...children, ...(index < nodes.length - 1 ? [$createLineBreakNode()] : [])];
        }
        return node.isInline() ? [node] : [];
    });
}

// Keep a pasted fragment inside a single-paragraph callout. Lexical still
// imports HTML and inline marks; block boundaries become line breaks.
export function registerCalloutPaste(editor) {
    return editor.registerCommand(PASTE_COMMAND, (event) => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return false;
        const block = $getTextBlock(selection.anchor.getNode());
        const withinCallout = block?.getType() === 'callout' && $getTextBlock(selection.focus.getNode())?.is(block) === true;
        const data = event?.clipboardData;
        if (!data) return false;
        const html = data.getData('text/html');
        const text = data.getData('text/plain');
        if (!html && !text) return false;
        if (!withinCallout && (!['paragraph', 'heading'].includes(block?.getType()) || !html.includes('data-oysite-callout'))) return false;
        let nodes;
        if (html) {
            const Parser = editor.getRootElement().ownerDocument.defaultView.DOMParser;
            nodes = $generateNodesFromDOM(editor, new Parser().parseFromString(html, 'text/html'));
            if (withinCallout) nodes = inlineContent(nodes);
            else if (!nodes.some((node) => node.getType() === 'callout')) return false;
        } else {
            nodes = text.replace(/\r\n?/g, '\n').split('\n').flatMap((line, index) => [
                ...(index ? [$createLineBreakNode()] : []),
                ...(line ? [$createTextNode(line).setFormat(selection.format).setStyle(selection.style)] : []),
            ]);
        }
        event.preventDefault();
        if (withinCallout) selection.insertNodes(nodes);
        else {
            // Native insertion merges the first/last pasted block with the
            // surrounding paragraph. Empty paragraph boundaries keep copied
            // callouts intact, with the original prefix/suffix outside them.
            const before = $createParagraphNode();
            const after = (block.getType() === 'heading' ? $createHeadingNode(block.getTag()) : $createParagraphNode())
                .setFormat(block.getFormatType()).setDirection(block.getDirection()).setIndent(block.getIndent());
            selection.insertNodes([before, ...nodes, after]);
            if (before.isAttached()) before.remove();
        }
        $addUpdateTag(HISTORY_PUSH_TAG);
        return true;
    }, COMMAND_PRIORITY_HIGH);
}
