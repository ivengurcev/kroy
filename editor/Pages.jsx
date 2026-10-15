import { useEffect, useState } from 'react';
import './editor.css';

export default function Pages() {
    const [pages, setPages] = useState([]);
    const [status, setStatus] = useState('loading');
    const [showForm, setShowForm] = useState(false);
    const [title, setTitle] = useState('');
    const [path, setPath] = useState('');
    const [createStatus, setCreateStatus] = useState('idle');

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
                            <a href={`/admin/pages/${page.id}/edit`}>
                                <strong>{page.title}</strong>
                                <span>{page.path}</span>
                            </a>
                        </li>
                    ))}
                </ul>
            )}
        </main>
    );
}
