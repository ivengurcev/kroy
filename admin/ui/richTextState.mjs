import { $createLineBreakNode, $createParagraphNode, $createTextNode, $getRoot, CLEAR_HISTORY_COMMAND, createEditor } from 'lexical';
import { isLexicalDocument } from '../../shared/richText.mjs';
import { normalizeLexicalDocument } from '../../shared/lexicalEditor.mjs';

export const EXTERNAL_RICHTEXT_TAG = 'kroy-external-richtext';

export function toLexicalDocument(value) {
    if (isLexicalDocument(value) && value.root.children.length) return normalizeLexicalDocument(value);
    const editor = createEditor({ namespace: 'KroyTextConversion', onError: (error) => { throw error; } });
    editor.update(() => {
        const root = $getRoot();
        const text = typeof value === 'string' ? value.replace(/\r\n?/g, '\n') : '';
        // A blank line separates paragraphs; additional/single line breaks stay in the text.
        for (const block of text.split('\n\n')) {
            const paragraph = $createParagraphNode();
            block.split('\n').forEach((line, index) => {
                if (index) paragraph.append($createLineBreakNode());
                if (line) paragraph.append($createTextNode(line));
            });
            root.append(paragraph);
        }
    }, { discrete: true });
    return editor.getEditorState().toJSON();
}

export function richTextValueKey(value) {
    // PostgreSQL JSONB and Lexical serialize object keys in different orders.
    return JSON.stringify(value ?? null, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
        ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]])) : item);
}

// Parent echoes must not replace the editor state: that would lose selection/history.
export function syncRichTextValue(editor, value, tracker, prepared = toLexicalDocument(value)) {
    const key = richTextValueKey(value);
    if (key === tracker.incoming) return false;
    tracker.incoming = key;
    if (key === tracker.emitted) return false;
    tracker.emitted = null;
    tracker.document = richTextValueKey(prepared);
    editor.setEditorState(editor.parseEditorState(prepared), { tag: EXTERNAL_RICHTEXT_TAG });
    editor.dispatchCommand(CLEAR_HISTORY_COMMAND, undefined);
    return true;
}

export function repairRichTextValue(value, prepared, tracker, onChange) {
    if (!isLexicalDocument(value) || richTextValueKey(value) === richTextValueKey(prepared)) return false;
    tracker.emitted = richTextValueKey(prepared);
    tracker.document = tracker.emitted;
    onChange(prepared);
    return true;
}
