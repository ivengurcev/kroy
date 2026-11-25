import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { HorizontalRuleNode, INSERT_HORIZONTAL_RULE_COMMAND } from '@lexical/react/LexicalHorizontalRuleNode';
import { HorizontalRulePlugin } from '@lexical/react/LexicalHorizontalRulePlugin';
import {
    $createParagraphNode,
    $getSelection,
    $isRangeSelection,
    CAN_REDO_COMMAND,
    CAN_UNDO_COMMAND,
    COMMAND_PRIORITY_EDITOR,
    FORMAT_TEXT_COMMAND,
    REDO_COMMAND,
    UNDO_COMMAND,
} from 'lexical';
import { $createHeadingNode, HeadingNode } from '@lexical/rich-text';
import {
    INSERT_ORDERED_LIST_COMMAND,
    INSERT_UNORDERED_LIST_COMMAND,
    ListItemNode,
    ListNode,
} from '@lexical/list';
import { LinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link';
import { $setBlocksType } from '@lexical/selection';
import Button from './Button.jsx';
import Icon from './Icon.jsx';
import styles from './RichTextEditor.module.css';
import { EXTERNAL_RICHTEXT_TAG, richTextValueKey, syncRichTextValue, toLexicalDocument } from './richTextState.mjs';

const EDITOR_THEME = {
    paragraph: styles.paragraph,
    heading: {
        h2: styles.heading2,
        h3: styles.heading3,
    },
    list: {
        ul: styles.unorderedList,
        ol: styles.orderedList,
        listitem: styles.listItem,
    },
    link: styles.link,
    hr: styles.separator,
    hrSelected: styles.separatorSelected,
    text: {
        bold: styles.bold,
        italic: styles.italic,
        underline: styles.underline,
    },
};

function ToolbarButton({ label, onClick, disabled = false, children }) {
    return (
        <Button
            className={styles.toolbarButton}
            variant="compact"
            type="button"
            title={label}
            aria-label={label}
            disabled={disabled}
            onMouseDown={(event) => event.preventDefault()}
            onClick={onClick}
        >
            {children || label}
        </Button>
    );
}

export function RichTextToolbar({ variant = 'compact' }) {
    const [editor] = useLexicalComposerContext();
    const [canUndo, setCanUndo] = useState(false);
    const [canRedo, setCanRedo] = useState(false);

    useEffect(() => {
        if (!editor) return undefined;
        const unregisterUndo = editor.registerCommand(CAN_UNDO_COMMAND, setCanUndo, COMMAND_PRIORITY_EDITOR);
        const unregisterRedo = editor.registerCommand(CAN_REDO_COMMAND, setCanRedo, COMMAND_PRIORITY_EDITOR);
        return () => {
            unregisterUndo();
            unregisterRedo();
        };
    }, [editor, setCanRedo, setCanUndo]);

    function setBlock(type) {
        editor?.update(() => {
            const selection = $getSelection();
            if (!$isRangeSelection(selection)) return;
            $setBlocksType(selection, () => type === 'paragraph' ? $createParagraphNode() : $createHeadingNode(type));
        });
    }

    function toggleLink() {
        if (!editor) return;
        const url = window.prompt('Адрес ссылки', 'https://');
        if (url === null) return;
        const value = url.trim();
        editor.dispatchCommand(TOGGLE_LINK_COMMAND, value || null);
    }

    return (
        <div className={styles.toolbar} role="toolbar" aria-label="Форматирование текста">
            {variant === 'full' && <div className={styles.toolbarGroup}>
                <ToolbarButton label="Абзац" onClick={() => setBlock('paragraph')}>¶</ToolbarButton>
                <ToolbarButton label="Заголовок H2" onClick={() => setBlock('h2')}>H2</ToolbarButton>
                <ToolbarButton label="Заголовок H3" onClick={() => setBlock('h3')}>H3</ToolbarButton>
            </div>}
            <div className={styles.toolbarGroup}>
                <ToolbarButton label="Жирный" onClick={() => editor?.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')}><strong>B</strong></ToolbarButton>
                <ToolbarButton label="Курсив" onClick={() => editor?.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')}><em>I</em></ToolbarButton>
                <ToolbarButton label="Подчёркнутый" onClick={() => editor?.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline')}><u>U</u></ToolbarButton>
                <ToolbarButton label="Маркированный список" onClick={() => editor?.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)}><Icon name="listBullet" size={20} /></ToolbarButton>
                <ToolbarButton label="Нумерованный список" onClick={() => editor?.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)}><Icon name="listOrdered" size={20} /></ToolbarButton>
                <ToolbarButton label="Горизонтальная линия (HR)" onClick={() => editor?.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, undefined)}>HR</ToolbarButton>
                <ToolbarButton label="Ссылка" onClick={toggleLink}><Icon name="globe" size={16} /></ToolbarButton>
            </div>
            <div className={styles.toolbarGroup}>
                <ToolbarButton label="Отменить" disabled={!canUndo} onClick={() => editor?.dispatchCommand(UNDO_COMMAND, undefined)}><Icon name="back" size={16} /></ToolbarButton>
                <ToolbarButton label="Повторить" disabled={!canRedo} onClick={() => editor?.dispatchCommand(REDO_COMMAND, undefined)}><Icon name="forward" size={16} /></ToolbarButton>
            </div>
        </div>
    );
}

function EditablePlugin({ disabled }) {
    const [editor] = useLexicalComposerContext();
    useEffect(() => { editor.setEditable(!disabled); }, [editor, disabled]);
    return null;
}

function ValuePlugin({ value, tracker }) {
    const [editor] = useLexicalComposerContext();
    useEffect(() => { syncRichTextValue(editor, value, tracker.current); }, [editor, value, tracker]);
    return null;
}

export default function RichTextEditor({ value, onChange, disabled = false, label = 'Текст', minHeight = '180px', name, variant = 'compact' }) {
    const [mounted, setMounted] = useState(false);
    const labelId = useId();
    const tracker = useRef({ incoming: richTextValueKey(value), emitted: null });

    useEffect(() => setMounted(true), []);

    // Keep Composer stable while typing; ValuePlugin handles external replacements.
    const initialConfig = useMemo(() => ({
        namespace: 'KroyRichTextEditor',
        theme: EDITOR_THEME,
        nodes: [HeadingNode, ListNode, ListItemNode, LinkNode, HorizontalRuleNode],
        onError(error) {
            console.error('Rich text editor error', error);
        },
        editorState: JSON.stringify(toLexicalDocument(value)),
    }), []);

    if (!mounted) {
        return <div className={styles.field} style={{ '--richtext-min-height': minHeight }}>
            <span id={labelId}>{label}</span>
            <div className={styles.placeholder} aria-busy="true">Редактор загружается…</div>
        </div>;
    }

    return (
        <div className={styles.field} style={{ '--richtext-min-height': minHeight }}>
            <span id={labelId}>{label}</span>
        <div className={`${styles.editor} ${disabled ? styles.disabled : ''}`} inert={disabled || undefined}>
            <LexicalComposer initialConfig={initialConfig}>
                <EditablePlugin disabled={disabled} />
                <ValuePlugin value={value} tracker={tracker} />
                <RichTextToolbar variant={variant} />
                <div className={styles.editableArea}>
                    <RichTextPlugin
                        contentEditable={<ContentEditable name={name} className={styles.contentEditable} aria-labelledby={labelId} />}
                        placeholder={<div className={styles.placeholderText}>Начните писать…</div>}
                        ErrorBoundary={LexicalErrorBoundary}
                    />
                </div>
                <HistoryPlugin />
                <ListPlugin />
                <LinkPlugin />
                <HorizontalRulePlugin />
                <OnChangePlugin
                    onChange={(editorState, editor, tags) => {
                        if (tags.has(EXTERNAL_RICHTEXT_TAG)) return;
                        const next = editorState.toJSON();
                        tracker.current.emitted = richTextValueKey(next);
                        onChange(next);
                    }}
                    ignoreSelectionChange
                />
            </LexicalComposer>
        </div>
        </div>
    );
}
