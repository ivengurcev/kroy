import { useEffect, useState } from 'react';
import PageList from '../components/admin/PageList.jsx';
import styles from './PagesPage.module.css';
import AdminPageShell from '../components/admin/AdminPageShell.jsx';
import Icon from '../components/ui/Icon.jsx';

export default function TrashPage() {
    const [pages, setPages] = useState([]);
    const [status, setStatus] = useState('loading');
    const [restoringPageId, setRestoringPageId] = useState(null);
    const [restoreErrorId, setRestoreErrorId] = useState(null);

    useEffect(() => {
        const controller = new AbortController();

        async function loadPages() {
            try {
                const response = await fetch('/api/pages?deleted=1', { signal: controller.signal });

                if (!response.ok) {
                    throw new Error(`Не удалось загрузить корзину: ${response.status}`);
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

    async function restorePage(pageId) {
        if (restoringPageId) return;

        setRestoringPageId(pageId);
        setRestoreErrorId(null);

        try {
            const response = await fetch(`/api/pages/${pageId}/restore`, { method: 'POST' });

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

    return (
        <AdminPageShell
            title="Корзина"
            actions={<a href="/admin/pages"><Icon name="back" /> Вернуться к страницам</a>}
            status={status}
            errorMessage="Не удалось загрузить корзину."
        >
            <div className={styles.content}>
                <PageList
                    pages={pages}
                    mode="trash"
                    busyPageId={restoringPageId}
                    actionErrorId={restoreErrorId}
                    onRestore={restorePage}
                />
            </div>
        </AdminPageShell>
    );
}
