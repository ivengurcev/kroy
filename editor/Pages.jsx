import { useEffect, useState } from 'react';
import './editor.css';

export default function Pages() {
    const [pages, setPages] = useState([]);
    const [status, setStatus] = useState('loading');

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
            <h1>Страницы</h1>

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
