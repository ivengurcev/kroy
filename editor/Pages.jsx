import { useEffect, useState } from 'react';
import './editor.css';

export default function Pages() {
    const [pages, setPages] = useState([]);
    const [status, setStatus] = useState('loading');
    const [showForm, setShowForm] = useState(false);
    const [title, setTitle] = useState('');
    const [path, setPath] = useState('');
    const [createStatus, setCreateStatus] = useState('idle');
    const [editingPage, setEditingPage] = useState(null);
    const [editStatus, setEditStatus] = useState('idle');
    const [deletingPageId, setDeletingPageId] = useState(null);
    const [deleteErrorId, setDeleteErrorId] = useState(null);

    useEffect(() => {
        const controller = new AbortController();

        async function loadPages() {
            try {
                const response = await fetch('/api/pages', {
                    signal: controller.signal,
                });

                if (!response.ok) {
                    throw new Error(`Не удалось загрузить страницы: ${response.status}`);
                }

                setPages(await response.json());
                setStatus('success');
            } catch (error) {
                if (error.name !== 'AbortError') {
                    setStatus('error');
                }
            }
        }

        loadPages();

        return () => controller.abort();
    }, []);

    async function createPage(event) {
        event.preventDefault();

        if (createStatus === 'submitting') return;

        setCreateStatus('submitting');

        try {
            const response = await fetch('/api/pages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ title, path }),
            });

            if (!response.ok) {
                throw new Error(`Не удалось создать страницу: ${response.status}`);
            }

            const page = await response.json();

            window.location.assign(`/admin/pages/${page.id}/edit`);
        } catch {
            setCreateStatus('error');
        }
    }

    async function updatePage(event) {
        event.preventDefault();

        if (!editingPage || editStatus === 'submitting') return;

        setEditStatus('submitting');

        const body = editingPage.originalPath === '/'
            ? { title: editingPage.title }
            : { title: editingPage.title, path: editingPage.path };

        try {
            const response = await fetch(`/api/pages/${editingPage.id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                throw new Error(`Не удалось изменить страницу: ${response.status}`);
            }

            const updatedPage = await response.json();

            setPages((previous) => previous.map((page) =>
                page.id === updatedPage.id
                    ? {
                        ...page,
                        title: updatedPage.title,
                        path: updatedPage.path,
                    }
                    : page
            ));
            setEditingPage(null);
            setEditStatus('idle');
        } catch {
            setEditStatus('error');
        }
    }

    async function deletePage(page) {
        if (
            page.path === '/'
            || deletingPageId
            || !window.confirm(`Удалить страницу «${page.title}»?`)
        ) {
            return;
        }

        setDeletingPageId(page.id);
        setDeleteErrorId(null);

        try {
            const response = await fetch(`/api/pages/${page.id}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                throw new Error(`Не удалось удалить страницу: ${response.status}`);
            }

            setPages((previous) => previous.filter(({ id }) => id !== page.id));

            if (editingPage?.id === page.id) {
                setEditingPage(null);
                setEditStatus('idle');
            }
        } catch {
            setDeleteErrorId(page.id);
        } finally {
            setDeletingPageId(null);
        }
    }

    if (status === 'loading') {
        return <main className="editor-status">Загрузка страниц…</main>;
    }

    if (status === 'error') {
        return (
            <main className="editor-status" role="alert">
                Не удалось загрузить страницы.
            </main>
        );
    }

    return (
        <main className="pages">
            <div className="pages-heading">
                <h1>Страницы</h1>

                {!showForm && (
                    <button type="button" onClick={() => setShowForm(true)}>
                        Создать страницу
                    </button>
                )}
            </div>

            {showForm && (
                <form className="create-page-form" onSubmit={createPage}>
                    <label>
                        Название
                        <input
                            type="text"
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                        />
                    </label>

                    <label>
                        Путь
                        <input
                            type="text"
                            value={path}
                            onChange={(event) => setPath(event.target.value)}
                        />
                    </label>

                    <div className="create-page-actions">
                        <button type="submit" disabled={createStatus === 'submitting'}>
                            {createStatus === 'submitting' ? 'Создание…' : 'Создать'}
                        </button>
                        <button
                            type="button"
                            disabled={createStatus === 'submitting'}
                            onClick={() => {
                                setShowForm(false);
                                setCreateStatus('idle');
                            }}
                        >
                            Отмена
                        </button>
                    </div>

                    {createStatus === 'error' && (
                        <p className="create-page-error" role="alert">
                            Не удалось создать страницу.
                        </p>
                    )}
                </form>
            )}

            {pages.length === 0 ? (
                <p>У сайта пока нет страниц.</p>
            ) : (
                <ul className="pages-list">
                    {pages.map((page) => (
                        <li key={page.id}>
                            <div className="pages-list-row">
                                <a href={`/admin/pages/${page.id}/edit`}>
                                    <strong>{page.title}</strong>
                                    <span>{page.path}</span>
                                </a>
                                <div className="page-actions">
                                    <button
                                        type="button"
                                        disabled={deletingPageId === page.id}
                                        onClick={() => {
                                            setEditingPage({
                                                ...page,
                                                originalPath: page.path,
                                            });
                                            setEditStatus('idle');
                                        }}
                                    >
                                        Изменить
                                    </button>

                                    {page.path !== '/' && (
                                        <button
                                            type="button"
                                            disabled={deletingPageId !== null}
                                            onClick={() => deletePage(page)}
                                        >
                                            {deletingPageId === page.id ? 'Удаление…' : 'Удалить'}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {deleteErrorId === page.id && (
                                <p className="delete-page-error" role="alert">
                                    Не удалось удалить страницу.
                                </p>
                            )}

                            {editingPage?.id === page.id && (
                                <form className="edit-page-form" onSubmit={updatePage}>
                                    <label>
                                        Название
                                        <input
                                            type="text"
                                            value={editingPage.title}
                                            onChange={(event) => setEditingPage({
                                                ...editingPage,
                                                title: event.target.value,
                                            })}
                                        />
                                    </label>

                                    <label>
                                        Путь
                                        <input
                                            type="text"
                                            value={editingPage.path}
                                            disabled={editingPage.originalPath === '/'}
                                            onChange={(event) => setEditingPage({
                                                ...editingPage,
                                                path: event.target.value,
                                            })}
                                        />
                                    </label>

                                    <div className="create-page-actions">
                                        <button
                                            type="submit"
                                            disabled={editStatus === 'submitting'}
                                        >
                                            {editStatus === 'submitting' ? 'Сохранение…' : 'Сохранить'}
                                        </button>
                                        <button
                                            type="button"
                                            disabled={editStatus === 'submitting'}
                                            onClick={() => {
                                                setEditingPage(null);
                                                setEditStatus('idle');
                                            }}
                                        >
                                            Отмена
                                        </button>
                                    </div>

                                    {editStatus === 'error' && (
                                        <p className="create-page-error" role="alert">
                                            Не удалось изменить страницу.
                                        </p>
                                    )}
                                </form>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </main>
    );
}
