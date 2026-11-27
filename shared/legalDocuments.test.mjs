import assert from 'node:assert/strict';
import test from 'node:test';
import { createEditor, $getRoot, $createParagraphNode, $createTextNode } from 'lexical';
import { HeadingNode, $createHeadingNode } from '@lexical/rich-text';
import { ListNode, ListItemNode, $createListNode, $createListItemNode } from '@lexical/list';
import { LinkNode, $createLinkNode } from '@lexical/link';
import { HorizontalRuleNode, $createHorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode';
import { isDocumentText, isLegalDocumentContent, legalDocumentBlock } from './legalDocuments.mjs';

test('the document validator accepts output from the full Lexical editor', () => {
    const editor = createEditor({ nodes: [HeadingNode, ListNode, ListItemNode, LinkNode, HorizontalRuleNode] });
    editor.update(() => {
        $getRoot().append(
            $createHeadingNode('h2').append($createTextNode('Условия')),
            $createParagraphNode().append($createLinkNode('/terms').append($createTextNode('Ссылка').toggleFormat('bold'))),
            $createListNode('number').append($createListItemNode().append($createTextNode('Пункт'))),
            $createHorizontalRuleNode(),
        );
    }, { discrete: true });
    const text = editor.getEditorState().toJSON();
    assert.equal(isDocumentText(text), true);
    assert.equal(isLegalDocumentContent([legalDocumentBlock(text)]), true);
    assert.equal(isLegalDocumentContent([legalDocumentBlock(text), legalDocumentBlock(text)]), false);
    assert.equal(isLegalDocumentContent([{ ...legalDocumentBlock(text), view: { name: '@kroy/text', props: {} } }]), false);

    for (const bad of ['text', {}, { root: { type: 'root', children: [] } },
        ...[null, { type: 'image', version: 1 }, { type: 'list', version: 1, children: [] },
            { type: 'paragraph', version: 1, children: [{ type: 'text', version: 1, text: {} }] }]
            .map((node) => ({ root: { ...text.root, children: [node] } })),
    ]) assert.equal(isDocumentText(bad), false);
});
