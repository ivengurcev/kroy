import { useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { defaultProps } from '../../shared/partModel.js';
import styles from './ListField.module.css';
import Button from '../ui/Button.jsx';
import Icon from '../ui/Icon.jsx';
import Modal from '../ui/Modal.jsx';
import ValidatedForm from '../ui/ValidatedForm.jsx';
import { listItemSummary, mergeListItem, moveListItem, updateListDraft } from './listFieldModel.mjs';
import theme from '../styles/AdminTheme.module.css';

export default function ListField({ label, itemLabel = 'Элемент', fields = {}, value, onChange, FieldComponent, createItem, renderItem, itemSummary, depth = 0 }) {
    const items = Array.isArray(value) ? value : [];
    const listId = useId();
    const formId = `${listId}-form`;
    const [dialog, setDialog] = useState(null);
    const [collapsed, setCollapsed] = useState(new Set());
    const nestedFields = Object.entries(fields).filter(([, field]) => field.type === 'list');
    const ownFields = Object.entries(fields).filter(([, field]) => field.type !== 'list');
    const keySequence = useRef(0);
    const itemKeysRef = useRef(null);
    const lastValueRef = useRef(value);
    const pendingValueRef = useRef(null);

    function createItemKey() {
        keySequence.current += 1;
        return `${listId}-${keySequence.current}`;
    }

    if (itemKeysRef.current === null) itemKeysRef.current = items.map(createItemKey);

    if (value !== lastValueRef.current) {
        if (value === pendingValueRef.current) {
            pendingValueRef.current = null;
        } else {
            const previous = lastValueRef.current;
            const oldItems = Array.isArray(previous) ? previous : [];
            const keys = itemKeysRef.current;
            const nextKeys = Array(items.length).fill(undefined);
            const used = new Set();
            items.forEach((item, index) => {
                const match = oldItems.findIndex((old, oldIndex) => !used.has(oldIndex) && Object.is(old, item));
                if (match >= 0) {
                    nextKeys[index] = keys[match];
                    used.add(match);
                }
            });
            const unmatchedOld = oldItems.map((_, index) => index).filter((index) => !used.has(index));
            const unmatchedNew = nextKeys.map((key, index) => key === undefined ? index : -1).filter((index) => index >= 0);
            if (unmatchedOld.length === 1 && unmatchedNew.length === 1) {
                nextKeys[unmatchedNew[0]] = keys[unmatchedOld[0]];
            }
            itemKeysRef.current = nextKeys.map((key) => key ?? createItemKey());
            pendingValueRef.current = null;
        }
        lastValueRef.current = value;
    }

    function emitChange(nextItems) {
        pendingValueRef.current = nextItems;
        onChange(nextItems);
    }

    function summary(item, index) {
        return itemSummary ? itemSummary(item) : listItemSummary(item, fields, index);
    }

    function editItem(index) {
        setDialog({ mode: 'edit', session: Symbol(), key: itemKeysRef.current[index], index,
            draft: structuredClone(items[index]), title: summary(items[index], index) });
    }

    function addItem() {
        setDialog({ mode: 'add', session: Symbol(), index: items.length,
            draft: structuredClone(createItem ? createItem() : defaultProps(fields)) });
    }

    function removeItem(index) {
        itemKeysRef.current = itemKeysRef.current.filter((_, i) => i !== index);
        emitChange(items.filter((_, i) => i !== index));
    }

    function requestRemove(index) {
        if (nestedFields.some(([name]) => items[index]?.[name]?.length)) {
            setDialog({ mode: 'delete', key: itemKeysRef.current[index], title: summary(items[index], index) });
        } else removeItem(index);
    }

    function saveItem(event) {
        event.preventDefault();
        event.stopPropagation();
        if (dialog.mode === 'add') {
            itemKeysRef.current = [...itemKeysRef.current, createItemKey()];
            emitChange([...items, dialog.draft]);
        } else {
            const index = itemKeysRef.current.indexOf(dialog.key);
            if (index >= 0) emitChange(items.map((item, i) => i === index ? mergeListItem(item, dialog.draft, fields) : item));
        }
        setDialog(null);
    }

    function updateDraft(session, changes) {
        setDialog((current) => updateListDraft(current, session, changes));
    }

    function moveItem(index, direction) {
        const next = moveListItem(items, index, direction);
        if (next === items) return;
        itemKeysRef.current = moveListItem(itemKeysRef.current, index, direction);
        emitChange(next);
    }

    function toggle(key) {
        setCollapsed((previous) => {
            const next = new Set(previous);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }

    return (
        <fieldset className={styles.listField} data-nested={depth > 0 || undefined}>
            <legend className={styles.listHeader}>
                <span>{label}</span>
                <Button variant="iconCompact" title={`Добавить ${itemLabel.toLowerCase()}`} aria-label={`Добавить ${itemLabel.toLowerCase()}`} onClick={addItem}>
                    <Icon name="add" size={18} />
                </Button>
            </legend>
            {items.length === 0 && <p className={styles.empty}>Список пуст. <Button variant="compact" onClick={addItem}>Добавить</Button></p>}
            <ul className={styles.items}>
                {items.map((item, index) => {
                    const key = itemKeysRef.current[index];
                    const title = summary(item, index);
                    const expanded = !collapsed.has(key);
                    const childCount = nestedFields.reduce((count, [name]) => count + (Array.isArray(item?.[name]) ? item[name].length : 0), 0);
                    return (
                        <li className={styles.listItem} key={key} data-parent={nestedFields.length > 0 || undefined}>
                            <div className={styles.itemHeader} data-selected={dialog?.key === key || undefined}>
                                {nestedFields.length > 0 && (
                                    <Button variant="listIcon" aria-expanded={expanded} aria-controls={`${key}-children`}
                                        title={expanded ? 'Свернуть вложенные списки' : 'Раскрыть вложенные списки'}
                                        aria-label={expanded ? 'Свернуть вложенные списки' : 'Раскрыть вложенные списки'}
                                        onClick={() => toggle(key)}>
                                        <Icon name="chevronRight" size={16} className={expanded ? styles.expanded : ''} />
                                    </Button>
                                )}
                                <button type="button" className={styles.summary} onClick={() => editItem(index)} title={typeof title === 'string' ? title : undefined}>
                                    <Icon name={nestedFields.length > 0 ? 'folder' : 'file'} size={16} className={styles.nodeIcon} />
                                    <span className={styles.nodeName}>{title}</span>
                                    {nestedFields.length > 0 && <small aria-label={`Вложенных элементов: ${childCount}`}>{childCount}</small>}
                                </button>
                                <div className={styles.actions}>
                                    <Button variant="listIcon" title="Переместить вверх" aria-label={`Переместить ${itemLabel.toLowerCase()} вверх`} disabled={index === 0} onClick={() => moveItem(index, -1)}><Icon name="up" size={16} /></Button>
                                    <Button variant="listIcon" title="Переместить вниз" aria-label={`Переместить ${itemLabel.toLowerCase()} вниз`} disabled={index === items.length - 1} onClick={() => moveItem(index, 1)}><Icon name="down" size={16} /></Button>
                                    <Button variant="listIcon" title="Редактировать" aria-label={`Редактировать ${itemLabel.toLowerCase()}`} onClick={() => editItem(index)}><Icon name="edit" size={16} /></Button>
                                    <Button variant="listIcon" title="Удалить" aria-label={`Удалить ${itemLabel.toLowerCase()}`} onClick={() => requestRemove(index)}><Icon name="delete" size={16} /></Button>
                                </div>
                            </div>
                            {nestedFields.length > 0 && (
                                <div className={styles.children} id={`${key}-children`} hidden={!expanded}>
                                    {nestedFields.map(([name, schema]) => (
                                        <div className={styles.childGroup} key={name}>
                                            <ListField label={schema.label ?? name} fields={schema.fields} itemLabel={schema.itemLabel}
                                                value={item?.[name]} FieldComponent={FieldComponent} depth={depth + 1}
                                                onChange={(nextValue) => emitChange(items.map((current, i) => i === index ? { ...current, [name]: nextValue } : current))} />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>
            {dialog && createPortal(
                <div className={theme.theme} onSubmit={(event) => event.stopPropagation()}>
                    <Modal title={<span className={styles.dialogTitle}>{dialog.mode === 'add' ? `Добавление — ${itemLabel}` : `${dialog.mode === 'delete' ? 'Удаление' : 'Редактирование'} — ${dialog.title}`}</span>}
                        onClose={() => setDialog(null)} actions={<>
                            <Button onClick={() => setDialog(null)}>Отмена</Button>
                            {dialog.mode === 'delete'
                                ? <Button onClick={() => { const index = itemKeysRef.current.indexOf(dialog.key); if (index >= 0) removeItem(index); setDialog(null); }}>Удалить вместе с вложенными</Button>
                                : <Button variant="primary" type="submit" form={formId}>Сохранить</Button>}
                        </>}>
                        {dialog.mode === 'delete'
                            ? <p>Будут удалены этот элемент и все его вложенные элементы. Продолжить?</p>
                            : <ValidatedForm id={formId} className={styles.editor} onSubmit={saveItem}>
                                {renderItem ? renderItem(dialog.draft, dialog.index, (changes) => updateDraft(dialog.session, changes)) : ownFields.map(([name, schema]) => (
                                    <FieldComponent key={name} name={name} schema={schema} value={dialog.draft?.[name]}
                                        onChange={(nextValue) => updateDraft(dialog.session, { [name]: nextValue })} />
                                ))}
                                {!renderItem && ownFields.length === 0 && <p>У этого элемента нет отдельных полей. Вложенные списки редактируются в дереве.</p>}
                            </ValidatedForm>}
                    </Modal>
                </div>, document.body
            )}
        </fieldset>
    );
}
