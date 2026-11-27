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
import { INSERT_HORIZONTAL_RULE_COMMAND } from '@lexical/react/LexicalHorizontalRuleNode';
import { HorizontalRulePlugin } from '@lexical/react/LexicalHorizontalRulePlugin';
import { TablePlugin } from '@lexical/react/LexicalTablePlugin';
import {
    $getSelection,
    $setSelection,
    CAN_REDO_COMMAND,
    CAN_UNDO_COMMAND,
    COMMAND_PRIORITY_EDITOR,
    FORMAT_TEXT_COMMAND,
    REDO_COMMAND,
    SELECTION_CHANGE_COMMAND,
    UNDO_COMMAND,
} from 'lexical';
import { TOGGLE_LINK_COMMAND } from '@lexical/link';
import { registerNodeStructure } from '@lexical/extension';
import { getRichTextHtml, getRichTextNodes } from '../../shared/lexicalEditor.mjs';
import { TableToolsButton } from './RichTextTableTools.jsx';
import ToolbarButton from './RichTextToolbarButton.jsx';
import RichTextAlignmentTools from './RichTextAlignmentTools.jsx';
import { registerCalloutPaste } from './richTextCallout.mjs';
import { $readToolbarState, $toggleBlock, $toggleCallout, $toggleList } from './richTextToolbar.mjs';
import styles from './RichTextEditor.module.css';
import { EXTERNAL_RICHTEXT_TAG, repairRichTextValue, richTextValueKey, syncRichTextValue, toLexicalDocument } from './richTextState.mjs';

const EDITOR_THEME = {
    paragraph: styles.paragraph,
    callout: styles.callout,
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
    table: styles.table,
    tableCell: styles.tableCell,
    tableCellHeader: styles.tableCellHeader,
    tableScrollableWrapper: styles.tableScrollable,
    tableCellSelected: styles.tableCellSelected,
    text: {
        bold: styles.bold,
        italic: styles.italic,
        underline: styles.underline,
    },
};

export function RichTextToolbar({ variant = 'compact' }) {
    const [editor] = useLexicalComposerContext();
    const [canUndo, setCanUndo] = useState(false);
    const [canRedo, setCanRedo] = useState(false);
    const [active, setActive] = useState({ block: 'paragraph', list: null, table: null });
    const selection = useRef(null);
    const toolbar = useRef(null);
    const stickySentinel = useRef(null);

    useEffect(() => {
        const element = toolbar.current;
        const sentinel = stickySentinel.current;
        if (!element || !sentinel || typeof IntersectionObserver === 'undefined') return undefined;
        const ancestors = [];
        let root = null;
        for (let parent = element.parentElement; parent; parent = parent.parentElement) {
            ancestors.push(parent);
            if (!root && /(auto|scroll|hidden|overlay)/.test(getComputedStyle(parent).overflowY)) root = parent;
        }
        let observer;
        const update = () => {
            const offset = (parseFloat(getComputedStyle(element).top) || 0)
                + (root ? parseFloat(getComputedStyle(root).paddingTop) || 0 : 0);
            observer?.disconnect();
            observer = new IntersectionObserver(([entry]) => {
                // Unlike !isIntersecting, this does not mark a toolbar below
                // the viewport as stuck. The root belongs to this scroller.
                element.toggleAttribute('data-stuck', entry.boundingClientRect.top < (entry.rootBounds?.top ?? offset));
            }, { root, rootMargin: `-${offset}px 0px 0px 0px`, threshold: [0, 1] });
            observer.observe(sentinel);
        };
        const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
        resizeObserver?.observe(element);
        // Ancestor resizing also covers measured admin/part-header offsets.
        ancestors.forEach((ancestor) => resizeObserver?.observe(ancestor));
        window.addEventListener('resize', update);
        update();
        return () => {
            observer?.disconnect();
            resizeObserver?.disconnect();
            window.removeEventListener('resize', update);
            element.removeAttribute('data-stuck');
        };
    }, []);

    useEffect(() => {
        if (!editor) return undefined;
        function read(external = false) {
            const current = $getSelection();
            if (!external && !current && toolbar.current?.contains(toolbar.current.ownerDocument.activeElement)) return;
            selection.current = current?.clone() ?? null;
            const next = $readToolbarState();
            setActive((previous) => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
        }
        editor.getEditorState().read(read);
        const unregisterUpdate = editor.registerUpdateListener(({ editorState, tags }) => editorState.read(() => read(tags.has(EXTERNAL_RICHTEXT_TAG))));
        const unregisterSelection = editor.registerCommand(SELECTION_CHANGE_COMMAND, () => { read(); return false; }, COMMAND_PRIORITY_EDITOR);
        const unregisterUndo = editor.registerCommand(CAN_UNDO_COMMAND, (value) => { setCanUndo(value); return false; }, COMMAND_PRIORITY_EDITOR);
        const unregisterRedo = editor.registerCommand(CAN_REDO_COMMAND, (value) => { setCanRedo(value); return false; }, COMMAND_PRIORITY_EDITOR);
        return () => {
            unregisterUpdate();
            unregisterSelection();
            unregisterUndo();
            unregisterRedo();
        };
    }, [editor, setCanRedo, setCanUndo]);

    function run(action) {
        editor?.update(() => {
            if (selection.current) $setSelection(selection.current.clone());
            action();
        });
        editor?.focus();
    }

    function toggleLink() {
        if (!editor) return;
        const url = window.prompt('Адрес ссылки', 'https://');
        if (url === null) return;
        const value = url.trim();
        run(() => editor.dispatchCommand(TOGGLE_LINK_COMMAND, value || null));
    }

    return (
        <>
        <span ref={stickySentinel} className={styles.stickySentinel} aria-hidden="true" />
        <div ref={toolbar} className={styles.toolbar} role="toolbar" aria-label="Форматирование текста" onKeyDown={(event) => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) || event.target.closest('[popover]')) return;
            const buttons = [...event.currentTarget.querySelectorAll('button:not(:disabled)')];
            const index = buttons.indexOf(event.target);
            if (index < 0) return;
            event.preventDefault();
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
                : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
            buttons[next]?.focus();
        }}>
            {variant === 'full' && <div className={styles.toolbarGroup}>
                <ToolbarButton label="Абзац" icon="paragraph" pressed={active.block === 'paragraph' && !active.list} onClick={() => run(() => $toggleBlock('paragraph'))} />
                <ToolbarButton label="Заголовок H2" icon="heading2" pressed={active.block === 'h2'} onClick={() => run(() => $toggleBlock('h2'))} />
                <ToolbarButton label="Заголовок H3" icon="heading3" pressed={active.block === 'h3'} onClick={() => run(() => $toggleBlock('h3'))} />
            </div>}
            {variant === 'full' && <div className={styles.toolbarGroup}>
                <RichTextAlignmentTools selection={selection} alignment={active.alignment} disabled={!active.canAlign} />
                <ToolbarButton label="Выделенный блок (Callout)" icon="callout" pressed={Boolean(active.callout)}
                    disabled={!active.canCallout} onClick={() => run($toggleCallout)} />
            </div>}
            <div className={styles.toolbarGroup}>
                <ToolbarButton label="Жирный" icon="bold" pressed={Boolean(active.bold)} onClick={() => run(() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold'))} />
                <ToolbarButton label="Курсив" icon="italic" pressed={Boolean(active.italic)} onClick={() => run(() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic'))} />
                <ToolbarButton label="Подчёркнутый" icon="underline" pressed={Boolean(active.underline)} onClick={() => run(() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline'))} />
            </div>
            <div className={styles.toolbarGroup}>
                <ToolbarButton label="Маркированный список" icon="listBullet" pressed={active.list === 'bullet'} onClick={() => run(() => $toggleList(editor, 'bullet'))} />
                <ToolbarButton label="Нумерованный список" icon="listOrdered" pressed={active.list === 'number'} onClick={() => run(() => $toggleList(editor, 'number'))} />
            </div>
            <div className={styles.toolbarGroup}>
                <ToolbarButton label="Ссылка" icon="link" pressed={Boolean(active.link)} onClick={toggleLink} />
                <ToolbarButton label="Горизонтальная линия (HR)" icon="horizontalRule" onClick={() => run(() => editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, undefined))} />
            </div>
            {variant === 'full' && <div className={styles.toolbarGroup}><TableToolsButton selection={selection} active={active.table} /></div>}
            <div className={styles.toolbarGroup}>
                <ToolbarButton label="Отменить" icon="back" disabled={!canUndo} onClick={() => editor?.dispatchCommand(UNDO_COMMAND, undefined)} />
                <ToolbarButton label="Повторить" icon="forward" disabled={!canRedo} onClick={() => editor?.dispatchCommand(REDO_COMMAND, undefined)} />
            </div>
        </div>
        </>
    );
}

function EditablePlugin({ disabled }) {
    const [editor] = useLexicalComposerContext();
    useEffect(() => { editor.setEditable(!disabled); }, [editor, disabled]);
    return null;
}

function StructurePlugin() {
    const [editor] = useLexicalComposerContext();
    // RichTextPlugin keeps Lexical's own HTML/clipboard importer. Repair imported
    // blocks in the same update, before serialization, without replacing selection/history.
    useEffect(() => registerNodeStructure(editor), [editor]);
    return null;
}

function CalloutPlugin() {
    const [editor] = useLexicalComposerContext();
    useEffect(() => registerCalloutPaste(editor), [editor]);
    return null;
}

function ValuePlugin({ value, prepared, tracker, onChange }) {
    const [editor] = useLexicalComposerContext();
    useEffect(() => {
        syncRichTextValue(editor, value, tracker.current, prepared);
        repairRichTextValue(value, prepared, tracker.current, onChange);
    }, [editor, value, prepared, tracker, onChange]);
    return null;
}

export default function RichTextEditor({ value, onChange, disabled = false, label = 'Текст', minHeight = '180px', name, variant = 'compact' }) {
    const [mounted, setMounted] = useState(false);
    const labelId = useId();
    const prepared = useMemo(() => {
        try { return { value: toLexicalDocument(value, variant) }; }
        catch { return { error: 'Не удалось безопасно восстановить структуру текста. Исходные данные сохранены: скопируйте их перед дальнейшими действиями.' }; }
    }, [value, variant]);
    const tracker = useRef({ incoming: richTextValueKey(value), emitted: null, document: richTextValueKey(prepared.value) });

    useEffect(() => setMounted(true), []);

    // Keep Composer stable while typing; ValuePlugin handles external replacements.
    const initialConfig = useMemo(() => ({
        namespace: `KroyRichTextEditor-${variant}`,
        theme: EDITOR_THEME,
        nodes: getRichTextNodes(variant),
        html: getRichTextHtml(variant),
        onError(error) {
            console.error('Rich text editor error', error);
        },
        editorState: prepared.value ? JSON.stringify(prepared.value) : undefined,
    }), [variant]);

    if (prepared.error) return <div className={styles.field}>
        <span>{label}</span>
        <p role="alert">{prepared.error}</p>
        <details><summary>Исходный Lexical JSON</summary><pre className={styles.source}>{JSON.stringify(value, null, 2)}</pre></details>
    </div>;

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
            <LexicalComposer key={variant} initialConfig={initialConfig}>
                <EditablePlugin disabled={disabled} />
                <StructurePlugin />
                {variant === 'full' && <CalloutPlugin />}
                <ValuePlugin value={value} prepared={prepared.value} tracker={tracker} onChange={onChange} />
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
                {variant === 'full' && <TablePlugin hasCellMerge={false} hasCellBackgroundColor={false} hasHorizontalScroll />}
                <LinkPlugin />
                <HorizontalRulePlugin />
                <OnChangePlugin
                    onChange={(editorState, editor, tags) => {
                        if (tags.has(EXTERNAL_RICHTEXT_TAG)) return;
                        const next = editorState.toJSON();
                        const key = richTextValueKey(next);
                        if (key === tracker.current.document) return;
                        tracker.current.document = key;
                        tracker.current.emitted = key;
                        onChange(next);
                    }}
                    ignoreSelectionChange
                />
            </LexicalComposer>
        </div>
        </div>
    );
}
