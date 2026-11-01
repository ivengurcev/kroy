import { useEffect, useMemo, useRef, useState } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
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
import Button from '../ui/Button.jsx';
import Icon from '../ui/Icon.jsx';
import styles from './ArticleEditor.module.css';

const EMPTY_EDITOR_STATE = {
    root: {
        type: 'root',
        children: [],
        direction: null,
        format: '',
        indent: 0,
        version: 1,
    },
};

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

function ToolbarPlugin() {
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
        <div className={styles.toolbar} role="toolbar" aria-label="Форматирование статьи">
            <div className={styles.toolbarGroup}>
                <ToolbarButton label="Абзац" onClick={() => setBlock('paragraph')}>¶</ToolbarButton>
                <ToolbarButton label="Заголовок H2" onClick={() => setBlock('h2')}>H2</ToolbarButton>
                <ToolbarButton label="Заголовок H3" onClick={() => setBlock('h3')}>H3</ToolbarButton>
            </div>
            <div className={styles.toolbarGroup}>
                <ToolbarButton label="Жирный" onClick={() => editor?.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')}><strong>B</strong></ToolbarButton>
                <ToolbarButton label="Курсив" onClick={() => editor?.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')}><em>I</em></ToolbarButton>
                <ToolbarButton label="Подчёркнутый" onClick={() => editor?.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline')}><u>U</u></ToolbarButton>
                <ToolbarButton label="Маркированный список" onClick={() => editor?.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)}>•</ToolbarButton>
                <ToolbarButton label="Нумерованный список" onClick={() => editor?.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)}>1.</ToolbarButton>
                <ToolbarButton label="Ссылка" onClick={toggleLink}><Icon name="globe" size={16} /></ToolbarButton>
            </div>
            <div className={styles.toolbarGroup}>
                <ToolbarButton label="Отменить" disabled={!canUndo} onClick={() => editor?.dispatchCommand(UNDO_COMMAND, undefined)}><Icon name="back" size={16} /></ToolbarButton>
                <ToolbarButton label="Повторить" disabled={!canRedo} onClick={() => editor?.dispatchCommand(REDO_COMMAND, undefined)}><Icon name="forward" size={16} /></ToolbarButton>
            </div>
        </div>
    );
}

export default function ArticleEditor({ value, onChange, disabled = false }) {
    const [mounted, setMounted] = useState(false);
    const initialState = useRef(value ?? EMPTY_EDITOR_STATE);

    useEffect(() => setMounted(true), []);

    const initialConfig = useMemo(() => ({
        namespace: 'KroyArticleEditor',
        theme: EDITOR_THEME,
        nodes: [HeadingNode, ListNode, ListItemNode, LinkNode],
        onError(error) {
            console.error('Article editor error', error);
        },
        editorState: JSON.stringify(initialState.current),
    }), []);

    if (!mounted) {
        return <div className={styles.placeholder} aria-busy="true">Редактор загружается…</div>;
    }

    return (
        <div className={`${styles.editor} ${disabled ? styles.disabled : ''}`}>
            <LexicalComposer initialConfig={initialConfig}>
                <ToolbarPlugin />
                <RichTextPlugin
                    contentEditable={<ContentEditable className={styles.contentEditable} aria-label="Текст статьи" />}
                    placeholder={<div className={styles.placeholderText}>Начните писать статью…</div>}
                    ErrorBoundary={LexicalErrorBoundary}
                />
                <HistoryPlugin />
                <ListPlugin />
                <LinkPlugin />
                <OnChangePlugin
                    onChange={(editorState) => {
                        onChange(editorState.toJSON());
                    }}
                    ignoreSelectionChange
                />
            </LexicalComposer>
        </div>
    );
}
