import { useEffect, useState } from 'react';
import PageList from '../components/PageList.jsx';
import AdminPageShell from '../components/AdminPageShell.jsx';
import { AdminListToolbar } from '../components/AdminList.jsx';
import Button from '../ui/Button.jsx';
import Switch from '../ui/Switch.jsx';
import Icon from '../ui/Icon.jsx';
import { apiRequest } from '../editor/apiRequest.mjs';
import { useAppNavigate } from '../components/AdminWorkspaceContext.jsx';

export default function PagesPage({ initiallyShowDeleted = false }) {
    const navigate = useAppNavigate();
    const [pages, setPages] = useState([]);
    const [status, setStatus] = useState('loading');
    const [showDeleted, setShowDeleted] = useState(initiallyShowDeleted);
    const [busyPageId, setBusyPageId] = useState(null);
    const [error, setError] = useState('');

    async function loadPages(signal) {
        const response = await fetch('/api/pages?deleted=all', { signal });
        if (!response.ok) throw new Error('Не удалось загрузить страницы.');
        setPages(await response.json());
    }
    useEffect(() => {
        const controller = new AbortController();
        loadPages(controller.signal).then(() => setStatus('success')).catch((error) => {
            if (error.name !== 'AbortError') setStatus('error');
        });
        return () => controller.abort();
    }, []);

    async function action(pageId, url, options) {
        if (busyPageId) return;
        setBusyPageId(pageId);
        setError('');
        try {
            const response = await apiRequest(url, options);
            if (!response.ok) {
                const result = await response.json().catch(() => ({}));
                throw new Error(result.error || 'Не удалось выполнить действие.');
            }
            const result = response.status === 204 ? null : await response.json();
            await loadPages();
            return result;
        } catch (error) {
            setError(error.message);
        } finally {
            setBusyPageId(null);
        }
    }
    async function createDetailTemplate(page) {
        if (page.detailTemplateId) {
            if (page.detailTemplateDeletedAt) {
                const restored = await action(page.id, `/api/pages/${page.detailTemplateId}/restore`, { method: 'POST' });
                if (!restored) return;
            }
            navigate?.(`/admin/pages/${page.detailTemplateId}`);
            return;
        }
        const template = await action(page.id, `/api/pages/${page.id}/detail-template`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: `${page.title} — Детальная страница`, routeParam: 'slug' }),
        });
        if (template) navigate?.(`/admin/pages/${template.id}`);
    }
    return <AdminPageShell title="Карта страниц" list status={status} errorMessage="Не удалось загрузить страницы.">
        <AdminListToolbar actions={<Button variant="primary" size="compact" onClick={() => navigate?.('/admin/pages/new')}><Icon name="add" /> Создать страницу</Button>}>
            <Switch label="Показать удалённые" checked={showDeleted} onChange={(event) => setShowDeleted(event.target.checked)} />
        </AdminListToolbar>
        {error && <p role="alert">{error}</p>}
        <PageList pages={pages} showDeleted={showDeleted} busyPageId={busyPageId}
            onCreateDetailTemplate={createDetailTemplate}
            onRestore={(id) => action(id, `/api/pages/${id}/restore`, { method: 'POST' })}
            onDelete={(page) => {
                if (window.confirm(`Удалить страницу «${page.title}»?`)) action(page.id, `/api/pages/${page.id}`, { method: 'DELETE' });
            }} />
    </AdminPageShell>;
}
