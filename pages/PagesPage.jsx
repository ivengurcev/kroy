import { useEffect, useRef, useState } from 'react';
import styles from './PagesPage.module.css';
import PageList from '../components/admin/PageList.jsx';
import AdminPageShell from '../components/admin/AdminPageShell.jsx';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import Icon from '../components/ui/Icon.jsx';

export default function PagesPage() {
    const [pages, setPages] = useState([]);
    const [status, setStatus] = useState('loading');
    const [showForm, setShowForm] = useState(false);
    const [title, setTitle] = useState('');
    const [path, setPath] = useState('');
    const [createStatus, setCreateStatus] = useState('idle');
    const [deletingPageId, setDeletingPageId] = useState(null);
    const [deleteErrorId, setDeleteErrorId] = useState(null);
    const titleInputRef = useRef(null);

    useEffect(() => {
        const controller = new AbortController();

        async function loadPages() {
            try {
                const response = await fetch('/api/pages', { signal: controller.signal });

                if (!response.ok) {
                    throw new Error(`Не удалось загрузить страницы: ${response.status}`);
                }

                setPages(await response.json());
                setStatus('success');
            } catch (error) {
                if (error.name !== 'AbortError') setStatus('error');
            }
        }

        loadPages();

        return () => controller.abort();
    }, []);

    useEffect(() => {
        if (showForm) titleInputRef.current?.focus();
    }, [showForm]);

    async function createPage(event) {
        event.preventDefault();

        if (createStatus === 'submitting') return;

        setCreateStatus('submitting');

        try {
            const response = await fetch('/api/pages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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

    async function updatePage(pageId, values) {
        const page = pages.find(({ id }) => id === pageId);

        if (!page) throw new Error('Page not found');

        const body = page.path === '/'
            ? { title: values.title }
            : values;
        const response = await fetch(`/api/pages/${pageId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            throw new Error(`Не удалось изменить страницу: ${response.status}`);
        }

        const updatedPage = await response.json();

        setPages((previous) => previous.map((item) =>
            item.id === updatedPage.id
                ? { ...item, title: updatedPage.title, path: updatedPage.path }
                : item
        ));
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
            const response = await fetch(`/api/pages/${page.id}`, { method: 'DELETE' });

            if (!response.ok) {
                throw new Error(`Не удалось удалить страницу: ${response.status}`);
            }

            setPages((previous) => previous.filter(({ id }) => id !== page.id));
        } catch {
            setDeleteErrorId(page.id);
        } finally {
            setDeletingPageId(null);
        }
    }

    function closeCreateForm() {
        setShowForm(false);
        setCreateStatus('idle');
    }

    const actions = (
        <>
            <a href="/admin/pages/trash" title="Открыть корзину страниц"><Icon name="trash" /> Корзина</a>
            <Button variant="primary" title="Создать новую страницу" disabled={showForm} onClick={() => setShowForm(true)}>
                <Icon name="add" /> Создать страницу
            </Button>
        </>
    );

    return (
        <AdminPageShell
            title="Карта страниц"
            actions={actions}
            status={status}
            errorMessage="Не удалось загрузить страницы."
        >
            <div className={styles.content}>
                {showForm && (
                    <Card as="form" className={styles.createForm} onSubmit={createPage}>
                        <label>
                            <span>Название</span>
                            <input ref={titleInputRef} value={title} onChange={(event) => setTitle(event.target.value)} />
                        </label>
                        <label>
                            <span>Путь</span>
                            <input value={path} onChange={(event) => setPath(event.target.value)} />
                        </label>
                        <div className={styles.formActions}>
                            <Button type="submit" variant="primary" title="Создать страницу" disabled={createStatus === 'submitting'}>
                                <Icon name="add" /> {createStatus === 'submitting' ? 'Создание…' : 'Создать'}
                            </Button>
                            <Button title="Отменить создание страницы" disabled={createStatus === 'submitting'} onClick={closeCreateForm}><Icon name="close" /> Отмена</Button>
                        </div>
                        <div className={styles.formError} role={createStatus === 'error' ? 'alert' : undefined}>
                            {createStatus === 'error' && 'Не удалось создать страницу.'}
                        </div>
                    </Card>
                )}

                <PageList
                    pages={pages}
                    busyPageId={deletingPageId}
                    actionErrorId={deleteErrorId}
                    onUpdate={updatePage}
                    onDelete={deletePage}
                />
            </div>
        </AdminPageShell>
    );
}
