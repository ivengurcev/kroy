import { useEffect, useRef, useState } from 'react';
import styles from './PagesPage.module.css';
import PageList from '../components/PageList.jsx';
import AdminPageShell from '../components/AdminPageShell.jsx';
import Button from '../ui/Button.jsx';
import Card from '../ui/Card.jsx';
import Icon from '../ui/Icon.jsx';
import compactStyles from '../ui/CompactForm.module.css';
import { slugifyPageTitle } from '../../shared/pageFields.mjs';
import { PAGE_DATA_SOURCES } from '../../shared/pageDataSources.mjs';
import { useAppNavigate } from '../components/AdminWorkspaceContext.jsx';

export default function PagesPage() {
    const navigate = useAppNavigate();
    const [pages, setPages] = useState([]);
    const [status, setStatus] = useState('loading');
    const [showForm, setShowForm] = useState(false);
    const [title, setTitle] = useState('');
    const [path, setPath] = useState('');
    const [type, setType] = useState('standard');
    const [dataSource, setDataSource] = useState('materials');
    const [sections, setSections] = useState([]);
    const [materialSectionId, setMaterialSectionId] = useState('');
    const [pathEdited, setPathEdited] = useState(false);
    const [createStatus, setCreateStatus] = useState('idle');
    const [deletingPageId, setDeletingPageId] = useState(null);
    const [deleteErrorId, setDeleteErrorId] = useState(null);
    const titleInputRef = useRef(null);
    const generatedPath = slugifyPageTitle(title) ? `/${slugifyPageTitle(title)}` : '';

    useEffect(() => {
        fetch('/api/site/material-sections').then((response) => response.json()).then((result) => {
            const nextSections = Array.isArray(result) ? result : [];
            setSections(nextSections); setMaterialSectionId(nextSections[0]?.id || '');
        }).catch(() => {});
    }, []);

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
                body: JSON.stringify({ title, path: pathEdited ? path : generatedPath, type, dataSource: type === 'list' ? dataSource : null, materialSectionId: type === 'list' && dataSource === 'materials' ? materialSectionId : null }),
            });

            if (!response.ok) {
                const result = await response.json().catch(() => ({}));
                throw new Error(result.error || `Не удалось создать страницу: ${response.status}`);
            }

            const page = await response.json();

            navigate?.(page.path === '/' ? '/admin' : `/admin/pages/${page.id}`, { skipGuard: true });
        } catch {
            setCreateStatus('error');
        }
    }

    function updatePage(updatedPage) {
        setPages((previous) => previous.map((item) =>
            item.id === updatedPage.id
                ? { ...item, ...updatedPage }
                : item.id === updatedPage.detailTemplateId
                    ? { ...item, path: updatedPage.detailTemplatePath }
                : item
        ));
    }

    async function createDetailTemplate(page) {
        if (page.detailTemplateId) {
            if (page.detailTemplateDeletedAt) {
                const response = await fetch(`/api/pages/${page.detailTemplateId}/restore`, { method: 'POST' });
                if (!response.ok) { setDeleteErrorId(page.id); return; }
            }
            navigate?.(`/admin/pages/${page.detailTemplateId}`);
            return;
        }
        try {
            const response = await fetch(`/api/pages/${page.id}/detail-template`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: `${page.title} — Детальная страница`, routeParam: 'slug' }),
            });
            if (!response.ok) throw new Error();
            const template = await response.json();
            navigate?.(`/admin/pages/${template.id}`);
        } catch {
            setDeleteErrorId(page.id);
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
            <Button variant="primary" title="Создать новую страницу" disabled={showForm} onClick={() => setShowForm(true)}>
                <Icon name="add" /> Создать страницу
            </Button>
            <a href="/admin/pages/trash" title="Открыть корзину страниц"><Icon name="trash" /> Корзина</a>
        </>
    );

    return (
        <AdminPageShell
            title="Карта страниц"
            actions={actions}
            isDirty={showForm}
            status={status}
            errorMessage="Не удалось загрузить страницы."
        >
            <div className={styles.content}>
                {showForm && (
                    <Card as="form" className={styles.createForm} onSubmit={createPage}>
                        <label className={`${compactStyles.field} ${compactStyles.compact}`}>
                            <span>Название</span>
                            <input ref={titleInputRef} value={title} onChange={(event) => setTitle(event.target.value)} />
                        </label>
                        <label className={`${compactStyles.field} ${compactStyles.compact}`}>
                            <span>Тип страницы</span>
                            <select value={type} onChange={(event) => setType(event.target.value)}>
                                <option value="standard">Обычная</option>
                                <option value="list">Динамический список</option>
                            </select>
                        </label>
                        {type === 'list' && <label className={`${compactStyles.field} ${compactStyles.compact}`}>
                            <span>Источник данных</span>
                            <select value={dataSource} onChange={(event) => setDataSource(event.target.value)}>
                                {PAGE_DATA_SOURCES.map((source) => <option key={source.id} value={source.id}>{source.title}</option>)}
                            </select>
                        </label>}
                        {type === 'list' && dataSource === 'materials' && <label className={`${compactStyles.field} ${compactStyles.compact}`}>
                            <span>Раздел материалов</span>
                            <select value={materialSectionId} onChange={(event) => setMaterialSectionId(event.target.value)} required>
                                <option value="">Выберите раздел</option>{sections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}
                            </select>
                        </label>}
                        <label className={`${compactStyles.field} ${compactStyles.compact}`}>
                            <span>Путь</span>
                            <input value={pathEdited ? path : generatedPath} onChange={(event) => { setPath(event.target.value); setPathEdited(true); }} />
                        </label>
                        <div className={styles.formActions}>
                            <Button type="submit" variant="primary" title="Создать страницу" disabled={createStatus === 'submitting'}>
                                <Icon name="add" /> {createStatus === 'submitting' ? 'Создание…' : 'Создать'}
                            </Button>
                            <Button title="Отменить создание страницы" disabled={createStatus === 'submitting'} onClick={closeCreateForm}><Icon name="close" /> Отмена</Button>
                        </div>
                        <div className={styles.formError} role={createStatus === 'error' ? 'alert' : undefined}>
                            {createStatus === 'error' && 'Не удалось создать страницу. Проверьте источник данных, раздел и путь.'}
                        </div>
                    </Card>
                )}

                <PageList
                    pages={pages}
                    busyPageId={deletingPageId}
                    actionErrorId={deleteErrorId}
                    onUpdate={updatePage}
                    onDelete={deletePage}
                    onCreateDetailTemplate={createDetailTemplate}
                />
            </div>
        </AdminPageShell>
    );
}
