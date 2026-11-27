// Editor/server-only: public rendering must not import the Lexical engine.
import { $createParagraphNode, $getRoot, createEditor, getStaticNodeConfig, TextNode } from 'lexical';
import { namedSignals, registerNodeStructure } from '@lexical/extension';
import { HeadingNode } from '@lexical/rich-text';
import { ListNode, ListItemNode } from '@lexical/list';
import { AutoLinkNode, LinkNode, registerLink } from '@lexical/link';
import { HorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode';
import { isLexicalDocument, isSupportedLexicalDocument } from './richText.mjs';

export const RICH_TEXT_NODES = [HeadingNode, ListNode, ListItemNode, LinkNode, AutoLinkNode, HorizontalRuleNode];

const headingImports = getStaticNodeConfig(HeadingNode).ownNodeConfig.importDOM;
const textImports = getStaticNodeConfig(TextNode).ownNodeConfig.importDOM;

// Compose Lexical's converters: a span imported as a heading must retain the
// native text-style conversion too. No Word-specific markup/CSS parsing.
export const RICH_TEXT_HTML = { import: Object.fromEntries(
    ['span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].map((tag) => [tag, (element) => {
        const heading = headingImports[tag]?.(element);
        if (!heading) return textImports[tag]?.(element) ?? null;
        return { ...heading, conversion: (dom) => {
            const converted = heading.conversion(dom);
            const styled = textImports.span(dom)?.conversion(dom);
            return { ...converted, forChild: (node, parent) => {
                const child = converted.forChild ? converted.forChild(node, parent) : node;
                return styled?.forChild ? styled.forChild(child, parent) : child;
            } };
        } };
    }]),
) };

function documentText(value) {
    const stack = [value.root];
    const text = [];
    while (stack.length) {
        const node = stack.pop();
        if (!node || typeof node !== 'object') continue;
        if (typeof node.text === 'string') text.push(node.text);
        if (Array.isArray(node.children)) {
            for (let index = node.children.length - 1; index >= 0; index--) stack.push(node.children[index]);
        }
    }
    return text.join('');
}

export function normalizeLexicalDocument(value) {
    if (!isLexicalDocument(value)) throw new Error('Ожидается Lexical JSON.');
    if (value.root.children.length && isSupportedLexicalDocument(value)) return value;
    const editor = createEditor({ nodes: RICH_TEXT_NODES, onError: (error) => { throw error; } });
    if (value.root.children.length) editor.setEditorState(editor.parseEditorState(value));
    else editor.update(() => { $getRoot().append($createParagraphNode()); }, { discrete: true });
    const unregisterLinks = registerLink(editor, namedSignals({ attributes: undefined, validateUrl: undefined }));
    const unregister = registerNodeStructure(editor);
    try {
        editor.update(() => {}, { discrete: true });
        const next = editor.getEditorState().toJSON();
        if (!isSupportedLexicalDocument(next)) throw new Error('Структура текста не поддерживается.');
        if (documentText(value) !== documentText(next)) throw new Error('Нормализация изменила текст. Исходные данные оставлены без изменений.');
        return next;
    } finally {
        unregister();
        unregisterLinks();
    }
}

// Normalize a copy only when recovery succeeds. Invalid data still reaches strict validation.
export function repairDocumentText(value) {
    try { return normalizeLexicalDocument(value); } catch { return value; }
}

export function repairDocumentBlocks(content) {
    if (!Array.isArray(content)) return content;
    return content.map((block) => {
        if (block?.part !== '@kroy/document' || !block.props) return block;
        const text = repairDocumentText(block.props.content);
        return text === block.props.content ? block : { ...block, props: { ...block.props, content: text } };
    });
}
