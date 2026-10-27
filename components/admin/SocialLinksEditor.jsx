import { useEffect, useRef, useState } from 'react';
import Button from '../ui/Button.jsx';
import Icon from '../ui/Icon.jsx';
import {
    buildSocialLink,
    SOCIAL_TYPES,
    socialLabel,
    socialType,
} from '../../socialLinks.mjs';
import styles from './SocialLinksEditor.module.css';

function emptyItem() {
    return { type: 'telegram', value: '', name: socialLabel('telegram'), link: '' };
}

function summaryValue(item, type) {
    if (type === 'other') return item.value || item.link || 'Не настроено';
    return item.value || item.link || 'Не настроено';
}

export default function SocialLinksEditor({ value, onChange }) {
    const items = Array.isArray(value) ? value : [];
    const [expandedIndex, setExpandedIndex] = useState(null);
    const [menuIndex, setMenuIndex] = useState(null);
    const menuRef = useRef(null);
    const menuTriggerRef = useRef(null);

    useEffect(() => {
        if (expandedIndex !== null && expandedIndex >= items.length) setExpandedIndex(null);
        if (menuIndex !== null && menuIndex >= items.length) setMenuIndex(null);
    }, [expandedIndex, items.length, menuIndex]);

    useEffect(() => {
        if (menuIndex === null) return undefined;

        function closeOnPointerDown(event) {
            if (!menuRef.current?.contains(event.target) && !menuTriggerRef.current?.contains(event.target)) setMenuIndex(null);
        }

        function closeOnEscape(event) {
            if (event.key === 'Escape') {
                event.preventDefault();
                setMenuIndex(null);
                menuTriggerRef.current?.focus();
            }
        }

        document.addEventListener('pointerdown', closeOnPointerDown, true);
        document.addEventListener('keydown', closeOnEscape);
        return () => {
            document.removeEventListener('pointerdown', closeOnPointerDown, true);
            document.removeEventListener('keydown', closeOnEscape);
        };
    }, [menuIndex]);

    function update(index, changes) {
        onChange(items.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item));
    }

    function changeType(index, type) {
        update(index, { type, value: '', name: type === 'other' ? '' : socialLabel(type), link: '' });
    }

    function changeValue(index, nextValue) {
        const type = socialType(items[index]);
        update(index, { value: nextValue, link: buildSocialLink(type, nextValue) });
    }

    function addItem() {
        onChange([...items, emptyItem()]);
        setExpandedIndex(items.length);
        setMenuIndex(null);
    }

    function remove(index) {
        onChange(items.filter((_, itemIndex) => itemIndex !== index));
        setExpandedIndex((current) => current === index ? null : current > index ? current - 1 : current);
        setMenuIndex(null);
    }

    function move(index, direction) {
        const target = index + direction;
        if (target < 0 || target >= items.length) return;
        const next = [...items];
        [next[index], next[target]] = [next[target], next[index]];
        onChange(next);
        setExpandedIndex((current) => current === index ? target : current === target ? index : current);
        setMenuIndex(null);
    }

    return (
        <div className={styles.editor}>
            <div className={styles.label}>Социальные сети</div>
            <div className={styles.items}>
                {items.map((item, index) => {
                    const type = socialType(item);
                    const isExpanded = expandedIndex === index;
                    const isMenuOpen = menuIndex === index;
                    const previewLink = buildSocialLink(type, item.value || item.link);
                    const isNickname = !['max', 'other'].includes(type);
                    const editorId = `social-link-editor-${index}`;

                    return (
                        <div className={styles.item} key={`${type}-${index}`}>
                            <div className={styles.itemRow}>
                                <Button className={styles.summary} aria-expanded={isExpanded} aria-controls={editorId} title={isExpanded ? 'Свернуть ссылку' : 'Редактировать ссылку'} onClick={() => setExpandedIndex(isExpanded ? null : index)}>
                                    <span className={styles.summaryText}>
                                        <strong>{item.name || socialLabel(type)}</strong>
                                        <small>{summaryValue(item, type)}</small>
                                    </span>
                                    <Icon name="edit" />
                                </Button>
                                <Button className={styles.menuTrigger} variant="compact" ref={isMenuOpen ? menuTriggerRef : undefined} aria-label={`Действия: ${item.name || socialLabel(type)}`} title="Действия со ссылкой" aria-haspopup="menu" aria-expanded={isMenuOpen} onClick={() => setMenuIndex(isMenuOpen ? null : index)}>
                                    <Icon name="more" />
                                </Button>
                            </div>

                            {isMenuOpen && <div className={styles.menu} ref={menuRef} role="menu">
                                <Button role="menuitem" title="Переместить выше" disabled={index === 0} onClick={() => move(index, -1)}><Icon name="up" /> Переместить выше</Button>
                                <Button role="menuitem" title="Переместить ниже" disabled={index === items.length - 1} onClick={() => move(index, 1)}><Icon name="down" /> Переместить ниже</Button>
                                <Button role="menuitem" title="Удалить ссылку" onClick={() => remove(index)}><Icon name="delete" /> Удалить</Button>
                            </div>}

                            {isExpanded && <div className={styles.form} id={editorId}>
                                <label className={styles.formField}>
                                    <span>Тип</span>
                                    <select value={type} onChange={(event) => changeType(index, event.target.value)}>
                                        {SOCIAL_TYPES.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
                                    </select>
                                </label>
                                {isNickname && <label className={styles.formField}>
                                    <span>Никнейм</span>
                                    <input value={item.value ?? ''} placeholder="@username или полная ссылка" onChange={(event) => changeValue(index, event.target.value)} />
                                </label>}
                                {type === 'max' && <label className={styles.formField}>
                                    <span>Ссылка из приложения</span>
                                    <input type="url" value={item.value ?? ''} placeholder="https://max.ru/..." onChange={(event) => changeValue(index, event.target.value)} />
                                </label>}
                                {type === 'other' && <>
                                    <label className={styles.formField}>
                                        <span>Название</span>
                                        <input value={item.name ?? ''} onChange={(event) => update(index, { name: event.target.value })} />
                                    </label>
                                    <label className={styles.formField}>
                                        <span>Ссылка (HTTPS)</span>
                                        <input type="url" value={item.value ?? item.link ?? ''} placeholder="https://example.com" onChange={(event) => changeValue(index, event.target.value)} />
                                    </label>
                                </>}
                                {previewLink && <a className={styles.preview} href={previewLink} target="_blank" rel="noopener noreferrer">{previewLink}</a>}
                                {item.value && !previewLink && <p className={styles.error} role="alert">Введите корректную HTTPS-ссылку или никнейм.</p>}
                                <Button title="Закончить редактирование ссылки" onClick={() => setExpandedIndex(null)}>Готово</Button>
                            </div>}
                        </div>
                    );
                })}
            </div>
            <Button className={styles.addButton} title="Добавить социальную сеть" onClick={addItem}><Icon name="add" /> Добавить</Button>
        </div>
    );
}
