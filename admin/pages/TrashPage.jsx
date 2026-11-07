import { useEffect, useMemo, useState } from 'react';
import PageList from '../components/PageList.jsx';
import styles from './PagesPage.module.css';
import AdminPageShell from '../components/AdminPageShell.jsx';
import { AdminListToolbar } from '../components/AdminList.jsx';
import Icon from '../ui/Icon.jsx';

export default function TrashPage() {
    const [pages, setPages] = useState([]);
    const [status, setStatus] = useState('loading');
    const [restoringPageId, setRestoringPageId] = useState(null);
    const [restoreErrorId, setRestoreErrorId] = useState(null);
    const actions = useMemo(() => <a href="/admin/pages" aria-label="Вернуться к карте страниц" title="Вернуться к карте страниц"><Icon name="back" /> <span>Страницы</span></a>, []);

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
            headerMode="trash"
            title="Корзина"
            list
            status={status}
            errorMessage="Не удалось загрузить корзину."
        >
            <div className={styles.content}>
                <AdminListToolbar actions={<div className={styles.listActions}>{actions}</div>} />
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
