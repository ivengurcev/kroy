
import { useEffect, useId, useRef, useState } from 'react';
import { defaultProps } from './partModel.js';
import styles from './ListField.module.css';
import Button from '../components/ui/Button.jsx';
import Icon from '../components/ui/Icon.jsx';

function itemSummary(item, fields, index) {
    const entries = Object.entries(fields);
    const simpleEntries = entries.filter(([, schema]) =>
        !['list', 'image', 'checkbox'].includes(schema.type)
    );
    const preferred = ['title', 'name']
        .map((name) => simpleEntries.find(([fieldName]) => fieldName === name))
        .filter(Boolean);
    const candidates = [
        ...preferred,
        ...simpleEntries.filter(([name]) => !preferred.some(([preferredName]) => preferredName === name)),
    ];
    const values = candidates
        .map(([name]) => item?.[name])
        .filter((value) => value !== undefined && value !== null && String(value).trim())
        .map((value) => String(value).trim());
    const nestedList = entries.find(([name, schema]) =>
        schema.type === 'list' && Array.isArray(item?.[name])
    );

    return {
        primary: values[0] ?? `Элемент ${index + 1}`,
        secondary: values[1]
            ?? (nestedList ? `Элементов: ${item[nestedList[0]].length}` : ''),
    };
}

export default function ListField({
    label,
    fields,
    value,
    onChange,
    FieldComponent,
}) {
    const items = Array.isArray(value) ? value : [];
    const [expandedKey, setExpandedKey] = useState(null);
    const [menuKey, setMenuKey] = useState(null);
    const listId = useId();
    const keySequence = useRef(0);
    const itemKeysRef = useRef(null);
    const lastValueRef = useRef(value);
    const pendingValueRef = useRef(null);
    const externalVersionRef = useRef(0);
    const menuRef = useRef(null);
    const menuTriggerRef = useRef(null);

    function createItemKey() {
        keySequence.current += 1;
        return `${listId}-${keySequence.current}`;
    }

    if (itemKeysRef.current === null) {
        itemKeysRef.current = items.map(createItemKey);
    }

    if (value !== lastValueRef.current) {
        if (value === pendingValueRef.current) {
            pendingValueRef.current = null;
        } else {
            itemKeysRef.current = items.map(createItemKey);
            pendingValueRef.current = null;
            externalVersionRef.current += 1;
        }

        lastValueRef.current = value;
    }

    const externalVersion = externalVersionRef.current;

    useEffect(() => {
        setExpandedKey(null);
        setMenuKey(null);
    }, [externalVersion]);

    useEffect(() => {
        if (menuKey === null) return undefined;

        function handlePointerDown(event) {
            if (
                !menuRef.current?.contains(event.target)
                && !menuTriggerRef.current?.contains(event.target)
            ) {
                setMenuKey(null);
            }
        }

        function handleKeyDown(event) {
            if (event.key === 'Escape') {
                event.preventDefault();
                setMenuKey(null);
                menuTriggerRef.current?.focus();
            }
        }

        document.addEventListener('pointerdown', handlePointerDown, true);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('pointerdown', handlePointerDown, true);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [menuKey]);

    function emitChange(nextItems) {
        pendingValueRef.current = nextItems;
        onChange(nextItems);
    }

    function addItem() {
        const itemKey = createItemKey();

        itemKeysRef.current = [...itemKeysRef.current, itemKey];
        emitChange([...items, defaultProps(fields)]);
        setExpandedKey(itemKey);
        setMenuKey(null);
    }

    function removeItem(index) {
        const removedKey = itemKeysRef.current[index];

        itemKeysRef.current = itemKeysRef.current.filter((_, i) => i !== index);
        emitChange(items.filter((_, i) => i !== index));
        setExpandedKey((current) => current === removedKey ? null : current);
        setMenuKey(null);
    }

    function updateItem(index, name, value) {
        emitChange(
            items.map((item, i) =>
                i === index
                    ? { ...item, [name]: value }
                    : item
            )
        );
    }

    function moveItem(index, direction) {
        const target = index + direction;

        if (target < 0 || target >= items.length) return;

        const next = [...items];
        const nextKeys = [...itemKeysRef.current];

        [next[index], next[target]] = [
            next[target],
            next[index],
        ];
        [nextKeys[index], nextKeys[target]] = [
            nextKeys[target],
            nextKeys[index],
        ];

        itemKeysRef.current = nextKeys;
        emitChange(next);
        setMenuKey(null);
    }

    return (
        <fieldset className={styles.listField}>
            <legend>{label}</legend>

            <div className={styles.items}>
                {items.map((item, index) => {
                    const itemKey = itemKeysRef.current[index];
                    const summary = itemSummary(item, fields, index);
                    const isExpanded = expandedKey === itemKey;
                    const isMenuOpen = menuKey === itemKey;
                    const editorId = `${itemKey}-editor`;

                    return (
                        <div className={styles.listItem} key={itemKey}>
                            <div className={styles.itemRow}>
                                <Button
                                    className={styles.summary}
                                    aria-expanded={isExpanded}
                                    aria-controls={editorId}
                                    title={isExpanded ? `Свернуть ${summary.primary}` : `Редактировать ${summary.primary}`}
                                    onClick={() => setExpandedKey(isExpanded ? null : itemKey)}
                                >
                                    <span className={styles.summaryText}>
                                        <strong>{summary.primary}</strong>
                                        {summary.secondary && <small>{summary.secondary}</small>}
                                    </span>
                                    <Icon name="edit" />
                                </Button>

                                <Button
                                    className={styles.menuTrigger}
                                    variant="compact"
                                    ref={isMenuOpen ? menuTriggerRef : undefined}
                                    aria-label={`Действия: ${summary.primary}`}
                                    title={`Действия с элементом ${summary.primary}`}
                                    aria-haspopup="menu"
                                    aria-expanded={isMenuOpen}
                                    onClick={() => setMenuKey(isMenuOpen ? null : itemKey)}
                                >
                                    <Icon name="more" />
                                </Button>
                            </div>

                            {isMenuOpen && (
                                <div className={styles.menu} ref={menuRef} role="menu">
                                    <Button
                                        role="menuitem"
                                        title="Переместить элемент выше"
                                        disabled={index === 0}
                                        onClick={() => moveItem(index, -1)}
                                    >
                                        <Icon name="up" /> Переместить выше
                                    </Button>
                                    <Button
                                        role="menuitem"
                                        title="Переместить элемент ниже"
                                        disabled={index === items.length - 1}
                                        onClick={() => moveItem(index, 1)}
                                    >
                                        <Icon name="down" /> Переместить ниже
                                    </Button>
                                    <Button role="menuitem" title="Удалить элемент" onClick={() => removeItem(index)}>
                                        <Icon name="delete" /> Удалить
                                    </Button>
                                </div>
                            )}

                            {isExpanded && (
                                <div className={styles.editor} id={editorId}>
                                    {Object.entries(fields).map(([name, schema]) => (
                                        <FieldComponent
                                            key={name}
                                            name={name}
                                            schema={schema}
                                            value={item?.[name]}
                                            onChange={(value) => updateItem(index, name, value)}
                                        />
                                    ))}

                                    <Button title="Закончить редактирование элемента" onClick={() => setExpandedKey(null)}>
                                        Готово
                                    </Button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <Button className={styles.addButton} title="Добавить элемент списка" onClick={addItem}>
                <Icon name="add" /> Добавить
            </Button>
        </fieldset>
    );
}
