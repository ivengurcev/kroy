import { useEffect, useRef, useState } from 'react';
import styles from './PageList.module.css';
import Button from '../ui/Button.jsx';
import Icon from '../ui/Icon.jsx';
import PageDetailsForm from './PageDetailsForm.jsx';
import Table from '../ui/Table.jsx';
import listStyles from './AdminList.module.css';

function pathDepth(path) {
    return path.split('/').filter(Boolean).length;
}

export default function PageList({
    pages,
    mode = 'active',
    busyPageId = null,
    actionErrorId = null,
    onUpdate,
    onDelete,
    onCreateDetailTemplate,
    onRestore,
    onDirtyChange,
}) {
    const [editingPage, setEditingPage] = useState(null);
    const [editDirty, setEditDirty] = useState(false);
    const [editErrorMessage, setEditErrorMessage] = useState('');
    useEffect(() => { onDirtyChange?.(editDirty); }, [editDirty, onDirtyChange]);
    const editButtons = useRef(new Map());
    const sortedPages = [...pages].sort((left, right) =>
        pathDepth(left.path) - pathDepth(right.path)
        || left.path.localeCompare(right.path)
    );
    function returnFocus(pageId) {
        requestAnimationFrame(() => editButtons.current.get(pageId)?.focus());
    }

    function startEditing(page) {
        if (editingPage?.id !== page.id && editDirty) return;

        setEditingPage(page);
        setEditDirty(false);
        setEditErrorMessage('');
    }

    function cancelEditing() {
        const pageId = editingPage?.id;

        setEditingPage(null);
        setEditDirty(false);
        setEditErrorMessage('');

        if (pageId) returnFocus(pageId);
    }

    function finishEditing(updatedPage) {
        const pageId = updatedPage.id;

        onUpdate(updatedPage);
        setEditingPage(null);
        setEditDirty(false);
        setEditErrorMessage('');
        returnFocus(pageId);
    }

    const errorMessage = editErrorMessage
        || (actionErrorId
            ? mode === 'trash'
                ? 'Не удалось восстановить страницу.'
                : 'Не удалось удалить страницу.'
            : '');

    return (
        <div className={styles.pageList}>
            {errorMessage && (
                <div className={styles.errorArea} role="alert">{errorMessage}</div>
            )}

            <Table className={styles.table} aria-label={mode === 'trash' ? 'Корзина страниц' : 'Страницы'}>
                    <thead><tr><th>Путь</th><th>Название</th><th>Действия</th></tr></thead>
                    <tbody>
                        {sortedPages.map((page) => {
                            const isEditing = editingPage?.id === page.id;

                            return (
                                <tr key={page.id}>
                                    {isEditing ? (
                                        <td colSpan="3">
                                        <PageDetailsForm
                                            key={page.id}
                                            className={styles.rowContents}
                                            pathClassName={styles.path}
                                            titleClassName={styles.title}
                                            actionsClassName={styles.actions}
                                            page={page}
                                            showError={false}
                                            onDirtyChange={setEditDirty}
                                            onErrorChange={setEditErrorMessage}
                                            onSaved={finishEditing}
                                            onCancel={cancelEditing}
                                        />
                                        </td>
                                    ) : (
                                        <>
                                            <td><span className={styles.path} title={page.path}>{page.path}</span></td>
                                            <td>
                                            {mode === 'active' ? (
                                                <a className={styles.title} href={page.path === '/' ? '/admin' : `/admin/pages/${page.id}`} title={page.title}>{page.title}</a>
                                            ) : (
                                                <span className={styles.title} title={page.title}>{page.title}</span>
                                            )}
                                            </td>
                                            <td><div className={listStyles.actions}>
                                                {mode === 'active' ? (
                                                    <>
                                                        {page.type === 'list' && <Button
                                                            variant="listIcon"
                                                            title={page.detailTemplateId ? 'Открыть шаблон детального просмотра' : 'Создать шаблон детального просмотра'}
                                                            aria-label={`${page.detailTemplateId ? 'Открыть' : 'Создать'} шаблон страницы «${page.title}»`}
                                                            onClick={() => onCreateDetailTemplate(page)}
                                                        >
                                                            <Icon name="pages" size={18} />
                                                        </Button>}
                                                        <Button
                                                            ref={(node) => {
                                                                if (node) editButtons.current.set(page.id, node);
                                                                else editButtons.current.delete(page.id);
                                                            }}
                                                            disabled={Boolean(editingPage && editingPage.id !== page.id && editDirty)}
                                                            variant="listIcon"
                                                            title="Изменить название и путь страницы"
                                                            aria-label={`Изменить название и путь страницы «${page.title}»`}
                                                            onClick={() => startEditing(page)}
                                                        >
                                                            <Icon name="edit" size={18} />
                                                        </Button>
                                                        {page.path !== '/' && (
                                                            <Button variant="listIcon" title="Удалить страницу в корзину" aria-label={`Удалить страницу «${page.title}»`} disabled={busyPageId !== null} onClick={() => onDelete(page)}>
                                                                <Icon name="delete" size={18} />
                                                            </Button>
                                                        )}
                                                    </>
                                                ) : (
                                                    <Button variant="listIcon" title="Восстановить страницу" aria-label={`Восстановить страницу «${page.title}»`} disabled={busyPageId !== null} onClick={() => onRestore(page.id)}>
                                                        <Icon name="restore" size={18} />
                                                    </Button>
                                                )}
                                            </div></td>
                                        </>
                                    )}
                                </tr>
                            );
                        })}
                        {!sortedPages.length && <tr><td className={listStyles.state} colSpan="3">{mode === 'trash' ? 'Корзина пуста.' : 'У сайта пока нет страниц.'}</td></tr>}
                    </tbody>
            </Table>
        </div>
    );
}
