import { useEffect, useMemo, useState } from 'react';
import Button from '../ui/Button.jsx';
import AdminPanel from '../ui/AdminPanel.jsx';
import Icon from '../ui/Icon.jsx';
import SiteSettingsLayout from '../components/SiteSettingsLayout.jsx';
import compactStyles from '../ui/CompactForm.module.css';
import styles from './SiteMaterialsPage.module.css';
import { useAppNavigate } from '../components/AdminWorkspaceContext.jsx';

const FILTERS = [
    { value: 'all', label: 'Все' },
    { value: 'draft', label: 'Черновики' },
    { value: 'published', label: 'Опубликованные' },
];
const STATUS_LABELS = { draft: 'Черновик', published: 'Опубликован' };

async function responseError(response, fallback) {
    const result = await response.json().catch(() => ({}));
    return result.error || `${fallback}: ${response.status}`;
}

function formatDate(value) {
    if (typeof value !== 'string') return '—';
    const date = new Date(value);
    return Number.isNaN(date.valueOf()) ? '—' : new Intl.DateTimeFormat('ru-RU', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(date);
}

export default function SiteMaterialsPage() {
    const navigate = useAppNavigate();
    const [filter, setFilter] = useState('all');
    const [materials, setMaterials] = useState([]);
    const [sections, setSections] = useState([]);
    const [sectionId, setSectionId] = useState('');
    const [sectionName, setSectionName] = useState('');
    const [sectionSlug, setSectionSlug] = useState('');
    const [sectionSortOrder, setSectionSortOrder] = useState(0);
    const [newSectionName, setNewSectionName] = useState('');
    const [newSectionSlug, setNewSectionSlug] = useState('');
    const [sectionError, setSectionError] = useState('');
    const [status, setStatus] = useState('loading');
    const [error, setError] = useState('');
    const [deletingId, setDeletingId] = useState(null);

    useEffect(() => {
        setSectionId(new URLSearchParams(window.location.search).get('sectionId') || '');
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        setStatus('loading');
        setError('');
        Promise.all([fetch('/api/site/material-sections', { signal: controller.signal }), fetch('/api/site/materials', { signal: controller.signal })])
            .then(async ([sectionsResponse, materialsResponse]) => {
                if (!sectionsResponse.ok) throw new Error(await responseError(sectionsResponse, 'Не удалось загрузить разделы'));
                if (!materialsResponse.ok) throw new Error(await responseError(materialsResponse, 'Не удалось загрузить материалы'));
                return Promise.all([sectionsResponse.json(), materialsResponse.json()]);
            })
            .then(([sectionResult, materialResult]) => {
                setSections(Array.isArray(sectionResult) ? sectionResult : []);
                setMaterials(Array.isArray(materialResult) ? materialResult : []);
                setSectionId((current) => current && sectionResult.some(({ id }) => id === current) ? current : sectionResult[0]?.id || '');
                setStatus('success');
            })
            .catch((loadError) => {
                if (loadError.name !== 'AbortError') { setError(loadError.message); setStatus('error'); }
            });
        return () => controller.abort();
    }, []);

    const selectedSection = sections.find(({ id }) => id === sectionId);
    const sectionDirty = Boolean(selectedSection && (
        sectionName !== selectedSection.name
        || sectionSlug !== selectedSection.slug
        || Number(sectionSortOrder) !== selectedSection.sortOrder
    )) || Boolean(newSectionName || newSectionSlug);

    useEffect(() => {
        setSectionName(selectedSection?.name || '');
        setSectionSlug(selectedSection?.slug || '');
        setSectionSortOrder(selectedSection?.sortOrder || 0);
    }, [sectionId, sections]);

    const visibleMaterials = useMemo(
        () => filter === 'all' ? materials.filter((material) => material.sectionId === sectionId) : materials.filter((material) => material.sectionId === sectionId && material.status === filter),
        [materials, filter, sectionId],
    );

    const actions = useMemo(() => <Button variant="primary" aria-label="Новый материал" onClick={() => navigate?.('/admin/site/materials/new')}><Icon name="add" /> <span>Новый материал</span></Button>, [navigate]);

    async function saveSection(event, id = null) {
        event.preventDefault(); setSectionError('');
        try {
            const response = await fetch(id ? `/api/site/material-sections/${id}` : '/api/site/material-sections', { method: id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(id ? { name: sectionName, slug: sectionSlug, sortOrder: Number(sectionSortOrder) } : { name: newSectionName, slug: newSectionSlug, sortOrder: sections.length }) });
            if (!response.ok) throw new Error(await responseError(response, 'Не удалось сохранить раздел'));
            const saved = await response.json(); setSections((current) => id ? current.map((item) => item.id === id ? saved : item) : [...current, saved]); setSectionId(saved.id); setNewSectionName(''); setNewSectionSlug('');
        } catch (saveError) { setSectionError(saveError.message); }
    }

    async function deleteSection() {
        const section = sections.find(({ id }) => id === sectionId);
        if (!section || !window.confirm(`Удалить раздел «${section.name}»?`)) return;
        try { const response = await fetch(`/api/site/material-sections/${section.id}`, { method: 'DELETE' }); if (!response.ok) throw new Error(await responseError(response, 'Не удалось удалить раздел')); setSections((current) => current.filter(({ id }) => id !== section.id)); setSectionId(sections.find(({ id }) => id !== section.id)?.id || ''); }
        catch (deleteError) { setSectionError(deleteError.message); }
    }

    async function deleteMaterial(material) {
        if (deletingId || !window.confirm(`Удалить материал «${material.title}»?`)) return;
        setDeletingId(material.id);
        setError('');
        try {
            const response = await fetch(`/api/site/materials/${material.id}`, { method: 'DELETE' });
            if (!response.ok) throw new Error(await responseError(response, 'Не удалось удалить материал'));
            setMaterials((current) => current.filter(({ id }) => id !== material.id));
        } catch (deleteError) {
            setError(deleteError.message);
        } finally {
            setDeletingId(null);
        }
    }

    return (
        <SiteSettingsLayout
            section="materials"
            title="Материалы"
            actions={actions}
            isDirty={sectionDirty}
            status={status}
            errorMessage={error || 'Не удалось загрузить материалы.'}
        >
            <div className={styles.content}>
                <p>Разделы и опубликованные материалы текущего сайта.</p>
                <AdminPanel className={styles.filterBar}>
                    <label className={`${compactStyles.field} ${compactStyles.compact}`}>
                        <span>Раздел</span>
                        <select value={sectionId} onChange={(event) => setSectionId(event.target.value)}>
                            {sections.map((section) => <option value={section.id} key={section.id}>{section.name}</option>)}
                        </select>
                    </label>
                    {sectionId && <Button variant="compact" onClick={deleteSection}>Удалить раздел</Button>}
                    {selectedSection && <form onSubmit={(event) => saveSection(event, selectedSection.id)} className={styles.toolbar}>
                        <label className={`${compactStyles.field} ${compactStyles.compact}`}><span>Название раздела</span><input value={sectionName} onChange={(event) => setSectionName(event.target.value)} required maxLength="200" /></label>
                        <label className={`${compactStyles.field} ${compactStyles.compact}`}><span>Внутренний slug</span><input value={sectionSlug} onChange={(event) => setSectionSlug(event.target.value)} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required /></label>
                        <label className={`${compactStyles.field} ${compactStyles.compact}`}><span>Порядок</span><input type="number" value={sectionSortOrder} onChange={(event) => setSectionSortOrder(event.target.value)} /></label>
                        <Button type="submit" variant="secondary">Сохранить раздел</Button>
                    </form>}
                    <form onSubmit={saveSection} className={styles.toolbar}>
                        <label className={`${compactStyles.field} ${compactStyles.compact}`}><span>Новый раздел</span><input value={newSectionName} onChange={(event) => setNewSectionName(event.target.value)} placeholder="Название" required /></label>
                        <label className={`${compactStyles.field} ${compactStyles.compact}`}><span>Внутренний slug</span><input value={newSectionSlug} onChange={(event) => setNewSectionSlug(event.target.value)} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required /></label>
                        <Button type="submit" variant="secondary"><Icon name="add" /> Добавить раздел</Button>
                    </form>
                    {sectionError && <p className={styles.actionError} role="alert">{sectionError}</p>}
                </AdminPanel>
                <AdminPanel className={styles.filterBar}>
                    <label className={`${compactStyles.field} ${compactStyles.compact}`}>
                        <span>Показать</span>
                        <select value={filter} onChange={(event) => setFilter(event.target.value)}>
                            {FILTERS.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
                        </select>
                    </label>
                </AdminPanel>
                {error && status === 'success' && <p className={styles.actionError} role="alert">{error}</p>}
                <AdminPanel className={styles.tableCard} noPadding>
                    <div className={styles.tableScroll}>
                        <table className={styles.table}>
                            <thead>
                                <tr><th>Название</th><th>Изменено</th><th>Статус</th><th><span className={styles.visuallyHidden}>Действия</span></th></tr>
                            </thead>
                            <tbody>
                                {visibleMaterials.map((material) => <tr key={material.id}>
                                    <td><strong>{material.title}</strong><small>/{material.slug}</small></td>
                                    <td>{formatDate(material.updatedAt)}</td>
                                    <td><span className={`${styles.status} ${styles[`status${material.status}`]}`}>{STATUS_LABELS[material.status] || material.status}</span></td>
                                    <td className={styles.actions}>
                                        <Button variant="compact" title="Редактировать материал" onClick={() => navigate?.(`/admin/site/materials/${material.id}`)} disabled={Boolean(deletingId)}><Icon name="edit" /></Button>
                                        <Button variant="compact" title="Удалить материал" onClick={() => deleteMaterial(material)} disabled={Boolean(deletingId)}><Icon name="delete" /></Button>
                                    </td>
                                </tr>)}
                                {!visibleMaterials.length && <tr><td className={styles.empty} colSpan="4">{materials.length ? 'Материалов в этом фильтре нет.' : 'Материалов пока нет.'}</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </AdminPanel>
            </div>
        </SiteSettingsLayout>
    );
}
