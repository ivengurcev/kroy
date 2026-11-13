import { useState } from 'react';
import styles from './PageList.module.css';
import Button from '../ui/Button.jsx';
import Icon from '../ui/Icon.jsx';
import listStyles from './AdminList.module.css';
import { buildPageTree, visiblePageRows, pageRedirects } from '../editor/pageTree.mjs';

function toggle(setState, key) {
    setState((previous) => {
        const next = new Set(previous);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
    });
}

export default function PageList({ pages, showDeleted = false, busyPageId = null, onDelete, onCreateDetailTemplate, onRestore }) {
    const [collapsed, setCollapsed] = useState(new Set());
    const [expandedRedirects, setExpandedRedirects] = useState(new Set());
    const rows = visiblePageRows(buildPageTree(pages, showDeleted), collapsed);
    return <div className={styles.tree} aria-label="Страницы">
        {rows.map((node) => <div key={node.path} style={{ '--depth': Math.min(node.depth, 4) }}>
            {!node.pages.length && <div className={styles.row}>
                <Button variant="listIcon" aria-label={`Ветка ${node.path}`} aria-expanded={!collapsed.has(node.path)} onClick={() => toggle(setCollapsed, node.path)}>
                    <Icon name={collapsed.has(node.path) ? 'chevronRight' : 'down'} size={18} />
                </Button>
                <span className={styles.path}>{node.path}</span>
            </div>}
            {node.pages.map((page, index) => {
                const deleted = Boolean(page.deleted_at);
                const redirects = pageRedirects(page);
                return <div key={page.id}>
                    <div className={`${styles.row} ${deleted ? styles.deleted : ''}`}>
                        {node.children.length > 0 && index === 0
                            ? <Button variant="listIcon" aria-label={`Дочерние страницы ${page.title}`} aria-expanded={!collapsed.has(node.path)} onClick={() => toggle(setCollapsed, node.path)}><Icon name={collapsed.has(node.path) ? 'chevronRight' : 'down'} size={18} /></Button>
                            : <span className={styles.spacer} />}
                        <div className={styles.info}>
                            <div className={styles.heading}>
                                {deleted ? <span>{page.title}</span> : <a href={page.path === '/' ? '/admin' : `/admin/pages/${page.id}`}>{page.title}</a>}
                                {deleted && <span className={styles.badge}>Удалена</span>}
                                {redirects.length > 0 && <Button size="compact" aria-label={`Перенаправления страницы ${page.title}: ${redirects.length}`} aria-expanded={expandedRedirects.has(page.id)} onClick={() => toggle(setExpandedRedirects, page.id)}>↪ {redirects.length}</Button>}
                            </div>
                            <span className={styles.path}>{page.path}</span>
                        </div>
                        <div className={listStyles.actions}>
                            {deleted ? <Button variant="listIcon" aria-label={`Восстановить страницу «${page.title}»`} title="Восстановить" disabled={busyPageId !== null} onClick={() => onRestore(page.id)}><Icon name="restore" size={18} /></Button> : <>
                                {page.type === 'list' && <Button variant="listIcon" title={page.detailTemplateId ? 'Открыть детальный шаблон' : 'Создать детальный шаблон'} aria-label={`Детальный шаблон «${page.title}»`} disabled={busyPageId !== null} onClick={() => onCreateDetailTemplate(page)}><Icon name="pages" size={18} /></Button>}
                                <a className={styles.edit} href={`/admin/pages/${page.id}/settings`} aria-label={`Настройки страницы «${page.title}»`} title="Настройки страницы"><Icon name="edit" size={18} /></a>
                                {page.path !== '/' && <Button variant="listIcon" title="Удалить" aria-label={`Удалить страницу «${page.title}»`} disabled={busyPageId !== null} onClick={() => onDelete(page)}><Icon name="delete" size={18} /></Button>}
                            </>}
                        </div>
                    </div>
                    {expandedRedirects.has(page.id) && redirects.map((path) => <div key={path} className={styles.redirect}>
                        <span className={styles.path}>↪ {path}</span><span className={styles.path}>301 → {page.path}</span>
                    </div>)}
                </div>;
            })}
        </div>)}
        {!rows.length && <p className={listStyles.state}>У сайта пока нет страниц.</p>}
    </div>;
}
