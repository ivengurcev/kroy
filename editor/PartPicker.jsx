import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Button from '../components/ui/Button.jsx';
import Icon from '../components/ui/Icon.jsx';
import theme from '../styles/AdminTheme.module.css';
import styles from './PartPicker.module.css';

function fallbackTitle(identifier) {
    return identifier.split('/').at(-1).replaceAll('-', ' ');
}

function partDetails(identifier, metadata) {
    return {
        identifier,
        title: metadata?.title || fallbackTitle(identifier),
        category: metadata?.category || 'Другое',
    };
}

export default function PartPicker({ anchor, metadata, onClose, onSelect }) {
    const [query, setQuery] = useState('');
    const [position, setPosition] = useState({ top: 12, left: 12, width: 360 });
    const pickerRef = useRef(null);
    const searchRef = useRef(null);
    const parts = useMemo(() => {
        const normalizedQuery = query.trim().toLocaleLowerCase();

        return Object.entries(metadata)
            .map(([identifier, partMetadata]) => partDetails(identifier, partMetadata))
            .filter(({ identifier, title, category }) => {
                return !normalizedQuery
                    || identifier.toLocaleLowerCase().includes(normalizedQuery)
                    || title.toLocaleLowerCase().includes(normalizedQuery)
                    || category.toLocaleLowerCase().includes(normalizedQuery);
            });
    }, [metadata, query]);
    const categories = useMemo(() => {
        const groups = new Map();

        for (const part of parts) {
            const category = groups.get(part.category) ?? [];
            category.push(part);
            groups.set(part.category, category);
        }

        return [...groups.entries()]
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([category, entries]) => ({
                category,
                entries: entries.sort((left, right) => left.title.localeCompare(right.title)),
            }));
    }, [parts]);

    useLayoutEffect(() => {
        function placePicker() {
            if (!anchor || !pickerRef.current) return;

            const anchorRect = anchor.getBoundingClientRect();
            const pickerRect = pickerRef.current.getBoundingClientRect();
            const edge = 12;
            const gap = 8;
            const width = Math.min(360, window.innerWidth - edge * 2);
            const left = Math.min(
                Math.max(edge, anchorRect.left + anchorRect.width / 2 - width / 2),
                window.innerWidth - width - edge
            );
            const fitsBelow = window.innerHeight - anchorRect.bottom >= pickerRect.height + gap;
            const top = fitsBelow
                ? anchorRect.bottom + gap
                : Math.max(edge, anchorRect.top - pickerRect.height - gap);

            setPosition({ top, left, width });
        }

        function handlePointerDown(event) {
            if (!pickerRef.current?.contains(event.target) && !anchor?.contains(event.target)) {
                onClose();
            }
        }

        function handleKeyDown(event) {
            if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
            }
        }

        placePicker();
        searchRef.current?.focus();
        document.addEventListener('pointerdown', handlePointerDown, true);
        document.addEventListener('keydown', handleKeyDown);
        window.addEventListener('resize', placePicker);
        window.addEventListener('scroll', placePicker, true);

        return () => {
            document.removeEventListener('pointerdown', handlePointerDown, true);
            document.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('resize', placePicker);
            window.removeEventListener('scroll', placePicker, true);
        };
    }, [anchor, onClose]);

    return createPortal(
        <section
            className={`${theme.theme} ${styles.picker}`}
            style={position}
            ref={pickerRef}
            data-editor-control
            role="dialog"
            aria-label="Добавить запчасть"
        >
            <header className={styles.header}>
                <h2>Добавить запчасть</h2>
                <Button variant="compact" aria-label="Закрыть выбор запчасти" title="Закрыть выбор запчасти" onClick={() => onClose()}>
                    <Icon name="close" />
                </Button>
            </header>
            <input
                className={styles.search}
                ref={searchRef}
                type="search"
                placeholder="Поиск"
                aria-label="Поиск запчастей"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
            />
            <div className={styles.list}>
                {categories.map(({ category, entries }) => (
                    <section className={styles.category} key={category}>
                        <h3>{category}</h3>
                        {entries.map(({ identifier, title }) => (
                            <Button className={styles.part} title={`Добавить запчасть ${title}`} key={identifier} onClick={() => onSelect(identifier)}>
                                <span>{title}</span>
                                <small>{identifier}</small>
                            </Button>
                        ))}
                    </section>
                ))}
                {parts.length === 0 && <p className={styles.empty}>Ничего не найдено.</p>}
            </div>
        </section>,
        document.body
    );
}
