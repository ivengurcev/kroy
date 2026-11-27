// Editor/server-only: public rendering must not import the Lexical engine.
import { $createLineBreakNode, $createParagraphNode, $createTabNode, $createTextNode, $getRoot, createEditor, getStaticNodeConfig, TextNode } from 'lexical';
import { namedSignals, registerNodeStructure } from '@lexical/extension';
import { HeadingNode } from '@lexical/rich-text';
import { ListNode, ListItemNode } from '@lexical/list';
import { AutoLinkNode, LinkNode, registerLink } from '@lexical/link';
import { HorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode';
import { TableNode, TableRowNode, TableCellNode, registerTablePlugin, registerTableCellUnmergeTransform } from '@lexical/table';
import { hasLexicalTables, isLexicalDocument, isSupportedLexicalDocument } from './richText.mjs';

export const RICH_TEXT_NODES = [HeadingNode, ListNode, ListItemNode, LinkNode, AutoLinkNode, HorizontalRuleNode];
export const FULL_RICH_TEXT_NODES = [...RICH_TEXT_NODES, TableNode, TableRowNode, TableCellNode];
export const getRichTextNodes = (variant) => variant === 'full' ? FULL_RICH_TEXT_NODES : RICH_TEXT_NODES;

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

const compactCell = (element) => ({
    conversion: () => ({ node: null, after: (children) => {
        // Use Lexical's imported nodes, not a Word/HTML parser. Drop cell styling,
        // keep paragraph breaks inside cells and tabs between adjacent cells.
        const text = children.map((child, index) => `${index && !children[index - 1].isInline() ? '\n' : ''}${child.getTextContent()}`).join('');
        const nodes = text.split('\n').flatMap((line, index) => [
            ...(index ? [$createLineBreakNode()] : []), ...(line ? [$createTextNode(line)] : []),
        ]);
        if (element.nextElementSibling) nodes.push($createTabNode());
        return nodes;
    } }),
    priority: 4,
});
const COMPACT_RICH_TEXT_HTML = { import: {
    ...RICH_TEXT_HTML.import,
    table: () => ({ conversion: () => ({ node: null }), priority: 4 }),
    tr: () => ({ conversion: () => ({ node: $createParagraphNode() }), priority: 4 }),
    td: compactCell,
    th: compactCell,
} };

export const getRichTextHtml = (variant) => variant === 'full' ? RICH_TEXT_HTML : COMPACT_RICH_TEXT_HTML;

export function registerFullTableTransforms(editor) {
    const unregister = registerTablePlugin(editor);
    const unmerge = registerTableCellUnmergeTransform(editor);
    const color = editor.registerNodeTransform(TableCellNode, (cell) => {
        if (cell.getBackgroundColor() !== null) cell.setBackgroundColor(null);
    });
    return () => { color(); unmerge(); unregister(); };
}

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

export function normalizeLexicalDocument(value, variant = 'full') {
    if (!isLexicalDocument(value)) throw new Error('Ожидается Lexical JSON.');
    if (variant !== 'full' && hasLexicalTables(value)) throw new Error('Таблицы доступны только в полном редакторе.');
    if (value.root.children.length && isSupportedLexicalDocument(value, variant)) return value;
    const editor = createEditor({ nodes: getRichTextNodes(variant), onError: (error) => { throw error; } });
    if (value.root.children.length) editor.setEditorState(editor.parseEditorState(value));
    else editor.update(() => { $getRoot().append($createParagraphNode()); }, { discrete: true });
    const unregisterLinks = registerLink(editor, namedSignals({ attributes: undefined, validateUrl: undefined }));
    const unregisterTables = variant === 'full' ? registerFullTableTransforms(editor) : () => {};
    const unregister = registerNodeStructure(editor);
    try {
        editor.update(() => {}, { discrete: true });
        const next = editor.getEditorState().toJSON();
        if (!isSupportedLexicalDocument(next, variant)) throw new Error('Структура текста не поддерживается.');
        if (documentText(value) !== documentText(next)) throw new Error('Нормализация изменила текст. Исходные данные оставлены без изменений.');
        return next;
    } finally {
        unregister();
        unregisterLinks();
        unregisterTables();
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
