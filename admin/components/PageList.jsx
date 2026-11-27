import { useState } from 'react';
import styles from './PageList.module.css';
import Button from '../ui/Button.jsx';
import Icon from '../ui/Icon.jsx';
import Tree, { TreeItem, TreeChildren, TreeEmpty } from '../ui/Tree.jsx';
import { buildPageTree, pageRedirects } from '../editor/pageTree.mjs';

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
    const nodes = buildPageTree(pages, showDeleted);

    function renderNodes(branches) {
        return branches.flatMap((node) => {
            const expanded = !collapsed.has(node.path);
            if (!node.pages.length) return <TreeItem key={node.path} label={node.path} title={node.path}
                folder expanded={expanded} count={node.children.length} toggleLabel={`Ветка ${node.path}`}
                onToggle={() => toggle(setCollapsed, node.path)}>
                {expanded && <TreeChildren><Tree>{renderNodes(node.children)}</Tree></TreeChildren>}
            </TreeItem>;
            return node.pages.map((page, index) => {
                const deleted = Boolean(page.deleted_at);
                const redirects = pageRedirects(page);
                const hasChildren = node.children.length > 0 && index === 0;
                const redirectsOpen = expandedRedirects.has(page.id);
                const legalLabel = page.isLegalDocument ? 'Правовой документ' : '';
                return <TreeItem key={page.id} folder={hasChildren} expanded={expanded} muted={deleted}
                    icon={page.isLegalDocument ? 'document' : undefined}
                    description={legalLabel || undefined}
                    descriptionId={legalLabel ? `legal-document-${page.id}` : undefined}
                    title={[page.title, page.path, legalLabel].filter(Boolean).join(' · ')} count={hasChildren ? node.children.length : undefined}
                    label={<span className={styles.label}><span className={styles.name}>{page.title}</span><small className={styles.path}>{page.path}</small>{deleted && <small className={styles.badge}>Удалена</small>}</span>}
                    href={deleted ? undefined : page.path === '/' ? '/admin' : `/admin/pages/${page.id}`}
                    toggleLabel={`Дочерние страницы ${page.title}`}
                    onToggle={hasChildren ? () => toggle(setCollapsed, node.path) : undefined}
                    actions={<>
                        {redirects.length > 0 && <Button variant="listIcon" title="Перенаправления"
                            aria-label={`Перенаправления страницы ${page.title}: ${redirects.length}`}
                            aria-expanded={redirectsOpen} onClick={() => toggle(setExpandedRedirects, page.id)}>{redirects.length}</Button>}
                        {deleted ? <Button variant="listIcon" aria-label={`Восстановить страницу «${page.title}»`} title="Восстановить" disabled={busyPageId !== null} onClick={() => onRestore(page.id)}><Icon name="restore" size={16} /></Button> : <>
                            {page.type === 'list' && <Button variant="listIcon" title={page.detailTemplateId ? 'Открыть детальный шаблон' : 'Создать детальный шаблон'} aria-label={`Детальный шаблон «${page.title}»`} disabled={busyPageId !== null} onClick={() => onCreateDetailTemplate(page)}><Icon name="pages" size={16} /></Button>}
                            <a href={`/admin/pages/${page.id}/settings`} aria-label={`Настройки страницы «${page.title}»`} title="Настройки страницы"><Icon name="edit" size={16} /></a>
                            {page.path !== '/' && <Button variant="listIcon" title="Удалить" aria-label={`Удалить страницу «${page.title}»`} disabled={busyPageId !== null} onClick={() => onDelete(page)}><Icon name="delete" size={16} /></Button>}
                        </>}
                    </>}>
                    {(redirectsOpen && redirects.length > 0 || hasChildren && expanded) && <TreeChildren><Tree>
                        {redirectsOpen && redirects.map((path) => <TreeItem key={path} label={`↪ ${path}`} title={`301 → ${page.path}`} />)}
                        {hasChildren && expanded && renderNodes(node.children)}
                    </Tree></TreeChildren>}
                </TreeItem>;
            });
        });
    }

    return <div aria-label="Страницы">
        {nodes.length ? <Tree>{renderNodes(nodes)}</Tree> : <TreeEmpty>У сайта пока нет страниц.</TreeEmpty>}
    </div>;
}
