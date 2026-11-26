import { useEffect, useState } from 'react';
import AdminPageShell from '../components/AdminPageShell.jsx';
import { useAppNavigate } from '../components/AdminWorkspaceContext.jsx';
import AdminPanel from '../ui/AdminPanel.jsx';
import Button from '../ui/Button.jsx';
import { apiRequest, readApiError } from '../editor/apiRequest.mjs';

export default function TemplatesPage() {
    const navigate = useAppNavigate();
    const [list, setList] = useState(null);
    const [error, setError] = useState('');
    const [dependencies, setDependencies] = useState([]);
    const [name, setName] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        const controller = new AbortController();
        fetch('/api/templates', { signal: controller.signal, cache: 'no-store' })
            .then(async (response) => {
                if (!response.ok) throw await readApiError(response);
                setList(await response.json());
            })
            .catch((error) => { if (error.name !== 'AbortError') setError(error.message); });
        return () => controller.abort();
    }, []);

    async function create(event) {
        event.preventDefault();
        if (busy || !name.trim()) return;
        setBusy(true);
        setError('');
        setDependencies([]);
        try {
            const response = await apiRequest('/api/templates', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
            });
            if (!response.ok) throw await readApiError(response);
            const { id } = await response.json();
            navigate?.(`/admin/templates/${id}`, { skipGuard: true });
        } catch (error) {
            setError(error.message);
        } finally {
            setBusy(false);
        }
    }

    async function remove(template) {
        if (busy || !window.confirm(`Удалить шаблон «${template.name}»?`)) return;
        setBusy(true);
        setError('');
        setDependencies([]);
        try {
            const response = await apiRequest(`/api/templates/${template.id}`, { method: 'DELETE' });
            if (!response.ok) {
                const body = await response.json();
                setDependencies(body.dependencies ?? []);
                throw new Error(body.error);
            }
            setList((current) => ({ ...current, templates: current.templates.filter(({ id }) => id !== template.id) }));
        } catch (error) {
            setError(error.message);
        } finally {
            setBusy(false);
        }
    }

    return <AdminPageShell title="Шаблоны" list status={list ? 'success' : error ? 'error' : 'loading'} errorMessage={error}
        isDirty={Boolean(name.trim())} saveStatus={busy ? 'saving' : 'idle'}>
        {list && <>
            <AdminPanel as="form" onSubmit={create}>
                <label>Название нового шаблона <input value={name} maxLength={100} required onChange={(event) => setName(event.target.value)} /></label>
                <Button type="submit" disabled={busy || !name.trim()}>Создать шаблон</Button>
            </AdminPanel>
            {error && <p role="alert">{error}</p>}
            {dependencies.length > 0 && <ul>{dependencies.map(({ id, title, deleted }) =>
                <li key={id}>{deleted ? <a href="/admin/pages/trash">{title} — восстановите из корзины для переназначения</a>
                    : <a href={`/admin/pages/${id}`}>{title}</a>}</li>)}</ul>}
            <ul>{list.templates.map((template) => <li key={template.id}>
                <a href={`/admin/templates/${template.id}`}>{template.name}</a>
                {template.isMain && ' · Основной'}
                {template.id === list.defaultTemplateId && ' · По умолчанию'}
                {` · Страниц: ${template.explicit + template.inherited}, в корзине: ${template.deleted} `}
                {!template.isMain && <Button disabled={busy} onClick={() => remove(template)}>Удалить</Button>}
            </li>)}</ul>
        </>}
    </AdminPageShell>;
}
