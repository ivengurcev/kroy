import { useId, useRef } from 'react';
import { defaultProps } from '../../shared/partModel.js';
import styles from './ListField.module.css';
import Button from '../ui/Button.jsx';
import Icon from '../ui/Icon.jsx';

export default function ListField({ label, itemLabel = 'Элемент', fields, value, onChange, FieldComponent }) {
    const items = Array.isArray(value) ? value : [];
    const listId = useId();
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
            const nextKeys = Array(items.length);
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

    function addItem() {
        itemKeysRef.current = [...itemKeysRef.current, createItemKey()];
        emitChange([...items, defaultProps(fields)]);
    }

    function removeItem(index) {
        itemKeysRef.current = itemKeysRef.current.filter((_, i) => i !== index);
        emitChange(items.filter((_, i) => i !== index));
    }

    function updateItem(index, name, nextValue) {
        emitChange(items.map((item, i) => i === index ? { ...item, [name]: nextValue } : item));
    }

    function moveItem(index, direction) {
        const target = index + direction;
        if (target < 0 || target >= items.length) return;
        const next = [...items];
        const nextKeys = [...itemKeysRef.current];
        [next[index], next[target]] = [next[target], next[index]];
        [nextKeys[index], nextKeys[target]] = [nextKeys[target], nextKeys[index]];
        itemKeysRef.current = nextKeys;
        emitChange(next);
    }

    return (
        <fieldset className={styles.listField}>
            <legend>{label}</legend>
            <div className={styles.items}>
                {items.map((item, index) => {
                    const summary = item?.title ?? item?.name ?? '';
                    return (
                        <section className={styles.listItem} key={itemKeysRef.current[index]}>
                            <header className={styles.itemHeader}>
                                <strong>{itemLabel} {index + 1}{summary ? ` · ${summary}` : ''}</strong>
                                <div className={styles.actions}>
                                    <Button variant="iconAction" title={`Переместить ${itemLabel.toLowerCase()} вверх`} aria-label={`Переместить ${itemLabel.toLowerCase()} вверх`} disabled={index === 0} onClick={() => moveItem(index, -1)}><Icon name="up" /></Button>
                                    <Button variant="iconAction" title={`Переместить ${itemLabel.toLowerCase()} вниз`} aria-label={`Переместить ${itemLabel.toLowerCase()} вниз`} disabled={index === items.length - 1} onClick={() => moveItem(index, 1)}><Icon name="down" /></Button>
                                    <Button variant="iconAction" title={`Удалить ${itemLabel.toLowerCase()}`} aria-label={`Удалить ${itemLabel.toLowerCase()}`} onClick={() => removeItem(index)}><Icon name="delete" /></Button>
                                </div>
                            </header>
                            <div className={styles.editor}>
                                {Object.entries(fields).map(([name, schema]) => (
                                    <FieldComponent key={name} name={name} schema={schema} value={item?.[name]} onChange={(nextValue) => updateItem(index, name, nextValue)} />
                                ))}
                            </div>
                        </section>
                    );
                })}
            </div>
            <Button className={styles.addButton} title={`Добавить ${itemLabel.toLowerCase()}`} onClick={addItem}>
                <Icon name="add" /> Добавить {itemLabel.toLowerCase()}
            </Button>
        </fieldset>
    );
}
