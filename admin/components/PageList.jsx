import { useRef, useState } from 'react';
import styles from './PageList.module.css';
import Button from '../ui/Button.jsx';
import Icon from '../ui/Icon.jsx';
import PageDetailsForm from './PageDetailsForm.jsx';

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
}) {
    const [editingPage, setEditingPage] = useState(null);
    const [editDirty, setEditDirty] = useState(false);
    const [editErrorMessage, setEditErrorMessage] = useState('');
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
        <section className={styles.pageList}>
            {errorMessage && (
                <div className={styles.errorArea} role="alert">{errorMessage}</div>
            )}

            {sortedPages.length === 0 ? (
                <p className={styles.emptyState}>
                    {mode === 'trash' ? 'Корзина пуста.' : 'У сайта пока нет страниц.'}
                </p>
            ) : (
                <>
                    <div className={styles.listHeader} aria-hidden="true">
                        <span>Путь</span><span>Название</span><span>Действия</span>
                    </div>
                    <ul className={styles.list}>
                        {sortedPages.map((page) => {
                            const isEditing = editingPage?.id === page.id;

                            return (
                                <li className={`${styles.row} ${page.type === 'list' ? styles.listPageRow : ''}`} key={page.id}>
                                    {isEditing ? (
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
                                    ) : (
                                        <>
                                            <span className={styles.path} title={page.path}>{page.path}</span>
                                            {mode === 'active' ? (
                                                <a className={styles.title} href={page.path === '/' ? '/admin' : `/admin/pages/${page.id}`} title={page.title}>{page.title}</a>
                                            ) : (
                                                <span className={styles.title} title={page.title}>{page.title}</span>
                                            )}
                                            <div className={`${styles.actions} ${mode === 'trash' ? styles.singleAction : ''}`}>
                                                {mode === 'active' ? (
                                                    <>
                                                        {page.type === 'list' && <Button
                                                            title={page.detailTemplateId ? 'Открыть шаблон детального просмотра' : 'Создать шаблон детального просмотра'}
                                                            onClick={() => onCreateDetailTemplate(page)}
                                                        >
                                                            <Icon name="add" /> {page.detailTemplateId ? 'Шаблон' : 'Создать шаблон'}
                                                        </Button>}
                                                        <Button
                                                            ref={(node) => {
                                                                if (node) editButtons.current.set(page.id, node);
                                                                else editButtons.current.delete(page.id);
                                                            }}
                                                            disabled={Boolean(editingPage && editingPage.id !== page.id && editDirty)}
                                                            title="Изменить название и путь страницы"
                                                            onClick={() => startEditing(page)}
                                                        >
                                                            <Icon name="edit" /> Изменить
                                                        </Button>
                                                        {page.path === '/' ? <span /> : (
                                                            <Button title="Удалить страницу в корзину" disabled={busyPageId !== null} onClick={() => onDelete(page)}>
                                                                <Icon name="delete" /> {busyPageId === page.id ? 'Удаление…' : 'Удалить'}
                                                            </Button>
                                                        )}
                                                    </>
                                                ) : (
                                                    <Button title="Восстановить страницу" disabled={busyPageId !== null} onClick={() => onRestore(page.id)}>
                                                        <Icon name="restore" /> {busyPageId === page.id ? 'Восстановление…' : 'Восстановить'}
                                                    </Button>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </>
            )}
        </section>
    );
}
