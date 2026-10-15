import { useEffect, useState } from 'react';
import './editor.css';

export default function Trash() {
    const [pages, setPages] = useState([]);
    const [status, setStatus] = useState('loading');
    const [restoringPageId, setRestoringPageId] = useState(null);
    const [restoreErrorId, setRestoreErrorId] = useState(null);

    useEffect(() => {
        const controller = new AbortController();

        async function loadPages() {
            try {
                const response = await fetch('/api/pages?deleted=1', {
                    signal: controller.signal,
                });

                if (!response.ok) {
                    throw new Error(`Не удалось загрузить корзину: ${response.status}`);
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

    async function restorePage(pageId) {
        if (restoringPageId) return;

        setRestoringPageId(pageId);
        setRestoreErrorId(null);

        try {
            const response = await fetch(`/api/pages/${pageId}/restore`, {
                method: 'POST',
            });

            if (!response.ok) {
                throw new Error(`Не удалось восстановить страницу: ${response.status}`);
            }

            setPages((previous) => previous.filter(({ id }) => id !== pageId));
        } catch {
            setRestoreErrorId(pageId);
        } finally {
            setRestoringPageId(null);
        }
    }

    if (status === 'loading') {
        return <main className="editor-status">Загрузка корзины…</main>;
    }

    if (status === 'error') {
        return (
            <main className="editor-status" role="alert">
                Не удалось загрузить корзину.
            </main>
        );
    }

    return (
        <main className="pages">
            <div className="pages-heading">
                <h1>Корзина</h1>
                <a href="/admin/pages">Вернуться к страницам</a>
            </div>

            {pages.length === 0 ? (
                <p>Корзина пуста.</p>
            ) : (
                <ul className="pages-list">
                    {pages.map((page) => (
                        <li key={page.id}>
                            <div className="pages-list-row">
                                <div className="trash-page-details">
                                    <strong>{page.title}</strong>
                                    <span>{page.path}</span>
                                    <time dateTime={page.deleted_at}>
                                        {new Date(page.deleted_at).toLocaleString('ru-RU')}
                                    </time>
                                </div>
                                <button
                                    type="button"
                                    disabled={restoringPageId !== null}
                                    onClick={() => restorePage(page.id)}
                                >
                                    {restoringPageId === page.id
                                        ? 'Восстановление…'
                                        : 'Восстановить'}
                                </button>
                            </div>

                            {restoreErrorId === page.id && (
                                <p className="delete-page-error" role="alert">
                                    Не удалось восстановить страницу.
                                </p>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </main>
    );
}
