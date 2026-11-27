import { useEffect, useRef, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getSelection, $setSelection } from 'lexical';
import { INSERT_TABLE_COMMAND } from '@lexical/table';
import Button from './Button.jsx';
import { Input } from './NativeControls.jsx';
import { $applyTableAction, $selectedTable, $tableHeaders } from './richTextTables.mjs';
import styles from './RichTextEditor.module.css';

export function InsertTableButton() {
    const [editor] = useLexicalComposerContext();
    const [open, setOpen] = useState(false);
    const [rows, setRows] = useState('2');
    const [columns, setColumns] = useState('6');
    const selection = useRef(null);
    const valid = [rows, columns].every((value) => /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 50);
    function insert() {
        if (!valid) return;
        editor.update(() => {
            if (selection.current) $setSelection(selection.current.clone());
            editor.dispatchCommand(INSERT_TABLE_COMMAND, { rows, columns, includeHeaders: false });
        });
        setOpen(false);
        editor.focus();
    }
    return <div className={styles.tableInsert} onKeyDown={(event) => {
        if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); }
        if (event.key === 'Enter' && open) { event.preventDefault(); event.stopPropagation(); insert(); }
    }}>
        <Button variant="compact" className={styles.toolbarButton} aria-expanded={open} onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
                editor.getEditorState().read(() => { selection.current = $getSelection()?.clone() ?? null; });
                setOpen((current) => !current);
            }}>Таблица</Button>
        {open && <div className={styles.tableCreate} role="group" aria-label="Создание таблицы">
            <label>Строки<Input type="number" min="1" max="50" step="1" value={rows} onChange={(event) => setRows(event.target.value)} /></label>
            <label>Столбцы<Input type="number" min="1" max="50" step="1" value={columns} onChange={(event) => setColumns(event.target.value)} /></label>
            <Button variant="compact" disabled={!valid} onClick={insert}>Вставить</Button>
            <Button variant="compact" onClick={() => setOpen(false)}>Отмена</Button>
        </div>}
    </div>;
}

export function TableActions() {
    const [editor] = useLexicalComposerContext();
    const [active, setActive] = useState(null);
    const selection = useRef(null);
    useEffect(() => {
        function update() {
            const table = $selectedTable();
            if (table) selection.current = $getSelection().clone();
            const headers = table ? $tableHeaders(table) : null;
            setActive((current) => current?.key === table?.getKey() && current?.row === headers?.row && current?.column === headers?.column
                ? current : table ? { key: table.getKey(), ...headers } : null);
        }
        editor.getEditorState().read(update);
        return editor.registerUpdateListener(({ editorState }) => editorState.read(update));
    }, [editor]);
    if (!active) return null;
    function action(name) {
        editor.update(() => {
            if (selection.current) $setSelection(selection.current.clone());
            $applyTableAction(name);
        });
        editor.focus();
    }
    const actions = [
        ['row-before', 'Строка сверху'], ['row-after', 'Строка снизу'],
        ['column-before', 'Столбец слева'], ['column-after', 'Столбец справа'],
        ['delete-row', 'Удалить строку'], ['delete-column', 'Удалить столбец'],
        ['header-row', 'Заголовочная строка', active.row], ['header-column', 'Заголовочный столбец', active.column],
        ['delete-table', 'Удалить таблицу'],
    ];
    return <div className={styles.tableActions} role="group" aria-label="Действия с таблицей">
        {actions.map(([name, label, pressed]) => <Button key={name} variant="compact" aria-pressed={pressed}
            onMouseDown={(event) => event.preventDefault()} onClick={() => action(name)}>{label}</Button>)}
    </div>;
}
