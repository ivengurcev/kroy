
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
    const [expandedIndex, setExpandedIndex] = useState(null);
    const [menuIndex, setMenuIndex] = useState(null);
    const listId = useId();
    const menuRef = useRef(null);
    const menuTriggerRef = useRef(null);

    useEffect(() => {
        if (menuIndex === null) return undefined;

        function handlePointerDown(event) {
            if (
                !menuRef.current?.contains(event.target)
                && !menuTriggerRef.current?.contains(event.target)
            ) {
                setMenuIndex(null);
            }
        }

        function handleKeyDown(event) {
            if (event.key === 'Escape') {
                event.preventDefault();
                setMenuIndex(null);
                menuTriggerRef.current?.focus();
            }
        }

        document.addEventListener('pointerdown', handlePointerDown, true);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('pointerdown', handlePointerDown, true);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [menuIndex]);

    function addItem() {
        onChange([...items, defaultProps(fields)]);
        setExpandedIndex(items.length);
        setMenuIndex(null);
    }

    function removeItem(index) {
        onChange(items.filter((_, i) => i !== index));
        setExpandedIndex((current) => {
            if (current === index) return null;
            return current > index ? current - 1 : current;
        });
        setMenuIndex(null);
    }

    function updateItem(index, name, value) {
        onChange(
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

        [next[index], next[target]] = [
            next[target],
            next[index],
        ];

        onChange(next);
        setExpandedIndex((current) => {
            if (current === index) return target;
            if (current === target) return index;
            return current;
        });
        setMenuIndex(null);
    }

    return (
        <fieldset className={styles.listField}>
            <legend>{label}</legend>

            <div className={styles.items}>
                {items.map((item, index) => {
                    const summary = itemSummary(item, fields, index);
                    const isExpanded = expandedIndex === index;
                    const isMenuOpen = menuIndex === index;
                    const editorId = `${listId}-item-${index}`;

                    return (
                        <div className={styles.listItem} key={index}>
                            <div className={styles.itemRow}>
                                <Button
                                    className={styles.summary}
                                    aria-expanded={isExpanded}
                                    aria-controls={editorId}
                                    onClick={() => setExpandedIndex(isExpanded ? null : index)}
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
                                    aria-haspopup="menu"
                                    aria-expanded={isMenuOpen}
                                    onClick={() => setMenuIndex(isMenuOpen ? null : index)}
                                >
                                    <Icon name="more" />
                                </Button>
                            </div>

                            {isMenuOpen && (
                                <div className={styles.menu} ref={menuRef} role="menu">
                                    <Button
                                        role="menuitem"
                                        disabled={index === 0}
                                        onClick={() => moveItem(index, -1)}
                                    >
                                        <Icon name="up" /> Переместить выше
                                    </Button>
                                    <Button
                                        role="menuitem"
                                        disabled={index === items.length - 1}
                                        onClick={() => moveItem(index, 1)}
                                    >
                                        <Icon name="down" /> Переместить ниже
                                    </Button>
                                    <Button role="menuitem" onClick={() => removeItem(index)}>
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

                                    <Button onClick={() => setExpandedIndex(null)}>
                                        Готово
                                    </Button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <Button className={styles.addButton} onClick={addItem}>
                <Icon name="add" /> Добавить
            </Button>
        </fieldset>
    );
}
