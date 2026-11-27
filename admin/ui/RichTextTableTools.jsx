import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getSelection, $setSelection } from 'lexical';
import { INSERT_TABLE_COMMAND } from '@lexical/table';
import Button from './Button.jsx';
import ToolbarButton from './RichTextToolbarButton.jsx';
import { Input } from './NativeControls.jsx';
import { $applyTableAction, $selectedTable, $tableHeaders } from './richTextTables.mjs';
import { EXTERNAL_RICHTEXT_TAG } from './richTextState.mjs';
import styles from './RichTextEditor.module.css';

export function TableToolsButton({ selection, active }) {
    const [editor] = useLexicalComposerContext();
    const [context, setContext] = useState(null);
    const [rows, setRows] = useState('2');
    const [columns, setColumns] = useState('6');
    const trigger = useRef(null);
    const popup = useRef(null);
    const id = useId();
    const anchor = `--table-${id.replace(/[^a-z0-9-]/gi, '')}`;
    const valid = [rows, columns].every((value) => /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 50);
    useEffect(() => editor.registerUpdateListener(({ tags }) => {
        if (tags.has(EXTERNAL_RICHTEXT_TAG)) {
            popup.current?.hidePopover();
            setContext(null);
        }
    }), [editor]);

    function close(returnFocus = false) {
        popup.current?.hidePopover();
        setContext(null);
        if (returnFocus) trigger.current?.focus();
    }
    function open() {
        if (context) { close(true); return; }
        editor.update(() => {
            const current = $getSelection() ?? selection.current;
            if (current) $setSelection(current.clone());
            const table = $selectedTable();
            setContext({ selection: current?.clone() ?? null, table: table ? { key: table.getKey(), ...$tableHeaders(table) } : null });
        }, { discrete: true });
    }
    function apply(action) {
        if (!context || (!context.table && !valid)) return;
        editor.update(() => {
            if (context.selection) $setSelection(context.selection.clone());
            if (context.table) {
                // Resolve from the restored selection, never from a cached table key.
                if ($selectedTable()?.getKey() === context.table.key) $applyTableAction(action);
            } else {
                editor.dispatchCommand(INSERT_TABLE_COMMAND, { rows, columns, includeHeaders: false });
            }
        }, { discrete: true });
        close();
        editor.focus();
    }

    useLayoutEffect(() => {
        if (!context) return undefined;
        const element = popup.current;
        element.showPopover();
        const anchored = globalThis.CSS?.supports('top: anchor(bottom)') ?? false;
        function position() {
            const button = trigger.current.getBoundingClientRect();
            const box = element.getBoundingClientRect();
            element.style.setProperty('--richtext-popup-width', `${box.width}px`);
            element.style.setProperty('--richtext-popup-height', `${box.height}px`);
            if (!anchored) {
                element.style.left = `${Math.max(8, Math.min(button.left, window.innerWidth - box.width - 8))}px`;
                element.style.top = `${Math.max(8, Math.min(button.bottom + 8, window.innerHeight - box.height - 8))}px`;
            }
        }
        position();
        const observer = new ResizeObserver(position);
        observer.observe(element);
        window.addEventListener('resize', position);
        // Sticky itself is CSS-only. Only browsers without CSS anchors need
        // this fallback to keep a top-layer popup attached while scrolling.
        if (!anchored) document.addEventListener('scroll', position, true);
        element.querySelector('input, button')?.focus({ preventScroll: true });
        return () => {
            observer.disconnect();
            window.removeEventListener('resize', position);
            if (!anchored) document.removeEventListener('scroll', position, true);
        };
    }, [context]);

    const actions = [
        ['row-before', 'Вставить строку сверху'], ['row-after', 'Вставить строку снизу'],
        ['column-before', 'Вставить столбец слева'], ['column-after', 'Вставить столбец справа'],
        ['delete-row', 'Удалить строку'], ['delete-column', 'Удалить столбец'],
        ['header-row', 'Заголовочная строка', context?.table?.row],
        ['header-column', 'Заголовочный столбец', context?.table?.column],
        ['delete-table', 'Удалить таблицу'],
    ];
    return <>
        <ToolbarButton ref={trigger} label="Таблица" icon="table" pressed={Boolean(active)}
            style={{ anchorName: anchor }} aria-haspopup={active ? 'menu' : 'dialog'} aria-expanded={Boolean(context)} aria-controls={context ? id : undefined} onClick={open} />
        {context && <div ref={popup} id={id} popover="auto" style={{ positionAnchor: anchor }}
            className={styles.tablePopup} role={context.table ? 'menu' : 'dialog'}
            aria-label={context.table ? 'Действия с таблицей' : 'Создание таблицы'}
            onToggle={(event) => { if (event.newState === 'closed') setContext(null); }}
            onBlur={(event) => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) close(); }}
            onKeyDown={(event) => {
                if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); }
                if (context.table && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
                    event.preventDefault();
                    event.stopPropagation();
                    const buttons = [...event.currentTarget.querySelectorAll('button')];
                    const index = buttons.indexOf(document.activeElement);
                    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
                        : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
                    buttons[next]?.focus();
                }
                if (!context.table && event.key === 'Enter' && event.target.tagName === 'INPUT') {
                    event.preventDefault(); event.stopPropagation(); apply();
                }
            }}>
            {context.table ? actions.map(([name, label, checked]) => <Button key={name} variant="compact"
                className={styles.tableMenuItem} role={checked === undefined ? 'menuitem' : 'menuitemcheckbox'} aria-checked={checked}
                onClick={() => apply(name)}>{label}{checked !== undefined && <span aria-hidden="true">{checked ? '✓' : ''}</span>}</Button>)
                : <div className={styles.tableCreate}>
                    <label>Строки<Input type="number" min="1" max="50" step="1" value={rows} onChange={(event) => setRows(event.target.value)} /></label>
                    <label>Столбцы<Input type="number" min="1" max="50" step="1" value={columns} onChange={(event) => setColumns(event.target.value)} /></label>
                    <Button variant="compact" disabled={!valid} onClick={() => apply()}>Вставить</Button>
                    <Button variant="compact" onClick={() => close(true)}>Отмена</Button>
                </div>}
        </div>}
    </>;
}
