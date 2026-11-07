import { useState } from 'react';
import Button from '../ui/Button.jsx';
import Icon from '../ui/Icon.jsx';
import styles from './AdminList.module.css';

export function AdminListToolbar({ children, actions }) {
    return <div className={styles.toolbar}><div className={styles.filters}>{children}</div>{actions}</div>;
}

export function AdminListField({ label, children }) {
    const isSearch = children?.type === 'input' && children.props.type === 'search';
    return <label className={`${styles.field} ${isSearch ? styles.search : ''}`}>
        <span className={styles.visuallyHidden}>{label}</span>
        {isSearch && <Icon className={styles.searchIcon} name="search" size={18} />}
        {children}
    </label>;
}

export function Pagination({ page, hasNext, onChange, total }) {
    return <nav className={styles.pagination} aria-label="Пагинация">
        <span aria-live="polite">Страница {page + 1}{total !== undefined && ` · Всего: ${total}`}</span>
        <Button size="compact" disabled={page === 0} onClick={() => onChange(page - 1)}>Назад</Button>
        <Button size="compact" disabled={!hasNext} onClick={() => onChange(page + 1)}>Далее</Button>
    </nav>;
}

export function useListPage(items, key, size = 50) {
    const [position, setPosition] = useState({ key, page: 0 });
    const page = Math.min(position.key === key ? position.page : 0, Math.max(0, Math.ceil(items.length / size) - 1));
    return { items: items.slice(page * size, (page + 1) * size), pagination: { page, total: items.length, hasNext: (page + 1) * size < items.length, onChange: (next) => setPosition({ key, page: next }) } };
}
