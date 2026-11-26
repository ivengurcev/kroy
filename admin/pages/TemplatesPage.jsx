import { useEffect, useState } from 'react';
import AdminPageShell from '../components/AdminPageShell.jsx';
import { AdminListToolbar } from '../components/AdminList.jsx';
import { useAppNavigate } from '../components/AdminWorkspaceContext.jsx';
import Button from '../ui/Button.jsx';
import Icon from '../ui/Icon.jsx';
import FormField from '../ui/FormField.jsx';
import Modal from '../ui/Modal.jsx';
import Tree, { TreeEmpty, TreeItem } from '../ui/Tree.jsx';
import ValidatedForm from '../ui/ValidatedForm.jsx';
import { formResponseError } from '../ui/formValidation.mjs';
import { apiRequest, readApiError } from '../editor/apiRequest.mjs';
import listStyles from '../components/AdminList.module.css';
import fieldStyles from '../components/PageDetailsForm.module.css';
import rowStyles from './TemplatesPage.module.css';

const createForm = 'create-template-form';

export default function TemplatesPage() {
    const navigate = useAppNavigate();
    const [list, setList] = useState(null);
    const [error, setError] = useState('');
    const [dependencies, setDependencies] = useState([]);
    const [name, setName] = useState('');
    const [busy, setBusy] = useState(false);
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState('');

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

    function closeCreate() {
        setCreating(false);
        setName('');
        setCreateError('');
    }

    async function create(event) {
        event.preventDefault();
        if (busy || !creating || !name.trim()) return;
        const form = event.currentTarget;
        setBusy(true);
        setCreateError('');
        try {
            const response = await apiRequest('/api/templates', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
            });
            if (!response.ok) throw new Error(await formResponseError(response, form, 'Не удалось создать шаблон.'));
            const { id } = await response.json();
            closeCreate();
            navigate?.(`/admin/templates/${id}`, { skipGuard: true });
        } catch (error) {
            setCreateError(error.message);
        } finally {
            setBusy(false);
        }
    }

    async function remove(template) {
        if (busy || template.isMain || !window.confirm(`Удалить шаблон «${template.name}»?`)) return;
        setBusy(true);
        setError('');
        setDependencies([]);
        try {
            const response = await apiRequest(`/api/templates/${template.id}`, { method: 'DELETE' });
            if (!response.ok) {
                const body = await response.json().catch(() => ({}));
                setDependencies(body.dependencies ?? []);
                throw new Error(body.error || 'Не удалось удалить шаблон.');
            }
            setList((current) => ({ ...current, templates: current.templates.filter(({ id }) => id !== template.id) }));
        } catch (error) {
            setError(error.message);
        } finally {
            setBusy(false);
        }
    }

    return <AdminPageShell title="Шаблоны" list status={list ? 'success' : error ? 'error' : 'loading'} errorMessage={error}
        isDirty={creating && Boolean(name.trim())} saveStatus={busy ? 'saving' : 'idle'}>
        {list && <>
            <AdminListToolbar actions={<Button variant="primary" size="compact" disabled={busy}
                onClick={() => setCreating(true)}><Icon name="add" /> Создать шаблон</Button>} />
            {error && <p className={listStyles.error} role="alert">{error}</p>}
            {dependencies.length > 0 && <Tree aria-label="Страницы, использующие шаблон">
                {dependencies.map(({ id, title, deleted }) => <TreeItem key={id}
                    href={deleted ? '/admin/pages/trash' : `/admin/pages/${id}`} muted={deleted}
                    label={deleted ? `${title} — восстановите из корзины для переназначения` : title} />)}
            </Tree>}
            {list.templates.length ? <Tree aria-label="Шаблоны страниц">
                {list.templates.map((template) => {
                    const href = `/admin/templates/${template.id}`;
                    const count = template.explicit + template.inherited;
                    return <TreeItem key={template.id} href={href} title={template.name}
                        label={<span className={rowStyles.label}>
                            <span className={rowStyles.name}>{template.name}</span>
                            {template.isMain && <small>Основной</small>}
                            {template.id === list.defaultTemplateId && <small>По умолчанию</small>}
                            {(count > 0 || template.deleted > 0) && <small>
                                Страниц: {count}{template.deleted > 0 && ` · В корзине: ${template.deleted}`}
                            </small>}
                        </span>}
                        actions={<>
                            <a href={href} title="Редактировать" aria-label={`Редактировать шаблон «${template.name}»`}><Icon name="edit" size={16} /></a>
                            {!template.isMain && <Button variant="listIcon" title="Удалить" aria-label={`Удалить шаблон «${template.name}»`}
                                disabled={busy} onClick={() => remove(template)}><Icon name="delete" size={16} /></Button>}
                        </>} />;
                })}
            </Tree> : <TreeEmpty>У сайта пока нет шаблонов.</TreeEmpty>}
            {creating && <Modal title="Новый шаблон" busy={busy} onClose={closeCreate} actions={<>
                <Button disabled={busy} onClick={closeCreate}>Отмена</Button>
                <Button type="submit" form={createForm} variant="primary" disabled={busy || !name.trim()}>Создать</Button>
            </>}>
                <ValidatedForm id={createForm} onSubmit={create} aria-busy={busy}>
                    <FormField label="Название" className={fieldStyles.field}>
                        <input name="name" autoFocus required maxLength={100} readOnly={busy} value={name}
                            onChange={(event) => { setName(event.target.value); setCreateError(''); }} />
                    </FormField>
                    {createError && <p className={listStyles.error} role="alert">{createError}</p>}
                </ValidatedForm>
            </Modal>}
        </>}
    </AdminPageShell>;
}
