import { useEffect, useRef, useState } from 'react';
import styles from './PageList.module.css';
import Button from '../ui/Button.jsx';
import Icon from '../ui/Icon.jsx';

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
    onRestore,
}) {
    const [editing, setEditing] = useState(null);
    const [editStatus, setEditStatus] = useState('idle');
    const [editError, setEditError] = useState(false);
    const firstInputRef = useRef(null);
    const editButtons = useRef(new Map());
    const sortedPages = [...pages].sort((left, right) =>
        pathDepth(left.path) - pathDepth(right.path)
        || left.path.localeCompare(right.path)
    );
    const hasEditChanges = Boolean(editing) && (
        editing.title !== editing.originalTitle
        || editing.path !== editing.originalPath
    );

    useEffect(() => {
        firstInputRef.current?.focus();
    }, [editing?.id]);

    function returnFocus(pageId) {
        requestAnimationFrame(() => editButtons.current.get(pageId)?.focus());
    }

    function startEditing(page) {
        if (editing?.id !== page.id && hasEditChanges) return;

        setEditing({
            id: page.id,
            originalTitle: page.title,
            originalPath: page.path,
            title: page.title,
            path: page.path,
        });
        setEditStatus('idle');
        setEditError(false);
    }

    function cancelEditing() {
        const pageId = editing?.id;

        setEditing(null);
        setEditStatus('idle');
        setEditError(false);

        if (pageId) returnFocus(pageId);
    }

    async function submitEditing(event) {
        event.preventDefault();

        if (!editing || !hasEditChanges || editStatus === 'submitting') return;

        setEditStatus('submitting');
        setEditError(false);

        try {
            await onUpdate(editing.id, {
                title: editing.title,
                path: editing.path,
            });
            const pageId = editing.id;

            setEditing(null);
            setEditStatus('idle');
            returnFocus(pageId);
        } catch {
            setEditStatus('idle');
            setEditError(true);
        }
    }

    function handleEditKeyDown(event) {
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            cancelEditing();
        }
    }

    const errorMessage = editError
        ? 'Не удалось изменить страницу.'
        : actionErrorId
            ? mode === 'trash'
                ? 'Не удалось восстановить страницу.'
                : 'Не удалось удалить страницу.'
            : '';

    return (
        <section className={styles.pageList}>
            <div className={styles.errorArea} role={errorMessage ? 'alert' : undefined}>
                {errorMessage}
            </div>

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
                            const isEditing = editing?.id === page.id;

                            return (
                                <li className={styles.row} key={page.id}>
                                    {isEditing ? (
                                        <form className={styles.rowContents} onSubmit={submitEditing} onKeyDown={handleEditKeyDown}>
                                            <input
                                                className={styles.path}
                                                ref={page.path === '/' ? undefined : firstInputRef}
                                                aria-label="Путь"
                                                value={editing.path}
                                                disabled={page.path === '/' || editStatus === 'submitting'}
                                                onChange={(event) => setEditing({ ...editing, path: event.target.value })}
                                            />
                                            <input
                                                className={styles.title}
                                                ref={page.path === '/' ? firstInputRef : undefined}
                                                aria-label="Название"
                                                value={editing.title}
                                                disabled={editStatus === 'submitting'}
                                                onChange={(event) => setEditing({ ...editing, title: event.target.value })}
                                            />
                                            <div className={styles.actions}>
                                                <Button type="submit" variant="primary" disabled={!hasEditChanges || editStatus === 'submitting'}>
                                                    <Icon name="save" /> {editStatus === 'submitting' ? 'Сохранение…' : 'Сохранить'}
                                                </Button>
                                                <Button disabled={editStatus === 'submitting'} onClick={cancelEditing}><Icon name="close" /> Отмена</Button>
                                            </div>
                                        </form>
                                    ) : (
                                        <>
                                            <span className={styles.path} title={page.path}>{page.path}</span>
                                            {mode === 'active' ? (
                                                <a className={styles.title} href={`/admin/pages/${page.id}/edit`} title={page.title}>{page.title}</a>
                                            ) : (
                                                <span className={styles.title} title={page.title}>{page.title}</span>
                                            )}
                                            <div className={`${styles.actions} ${mode === 'trash' ? styles.singleAction : ''}`}>
                                                {mode === 'active' ? (
                                                    <>
                                                        <Button
                                                            ref={(node) => {
                                                                if (node) editButtons.current.set(page.id, node);
                                                                else editButtons.current.delete(page.id);
                                                            }}
                                                            disabled={Boolean(editing && editing.id !== page.id && hasEditChanges)}
                                                            onClick={() => startEditing(page)}
                                                        >
                                                            <Icon name="edit" /> Изменить
                                                        </Button>
                                                        {page.path === '/' ? <span /> : (
                                                            <Button disabled={busyPageId !== null} onClick={() => onDelete(page)}>
                                                                <Icon name="delete" /> {busyPageId === page.id ? 'Удаление…' : 'Удалить'}
                                                            </Button>
                                                        )}
                                                    </>
                                                ) : (
                                                    <Button disabled={busyPageId !== null} onClick={() => onRestore(page.id)}>
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
