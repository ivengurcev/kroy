import { useEffect, useMemo, useRef, useState } from 'react';
import Button from '../ui/Button.jsx';
import AdminPanel from '../ui/AdminPanel.jsx';
import Icon from '../ui/Icon.jsx';
import Tabs from '../ui/Tabs.jsx';
import StatusBadge from '../ui/StatusBadge.jsx';
import SiteSettingsLayout from '../components/SiteSettingsLayout.jsx';
import compactStyles from '../ui/CompactForm.module.css';
import fieldStyles from '../editor/Field.module.css';
import dialogStyles from '../components/PageDetailsDialog.module.css';
import styles from './SiteMaterialsPage.module.css';
import { useAppNavigate } from '../components/AdminWorkspaceContext.jsx';
import { slugifyPageTitle } from '../../shared/pageFields.mjs';
import ValidatedForm from '../ui/ValidatedForm.jsx';
import { apiRequest } from '../editor/apiRequest.mjs';
import { formResponseError } from '../ui/formValidation.mjs';

const FILTERS = [
    { value: 'all', label: 'Все статусы' },
    { value: 'draft', label: 'Черновики' },
    { value: 'published', label: 'Опубликованные' },
];
const STATUS_LABELS = { draft: 'Черновик', published: 'Опубликован' };
const STATUS_TONES = { draft: 'warning', published: 'success' };

async function responseError(response, fallback) {
    return response.status === 409 ? 'Раздел используется материалами или страницами. Сначала уберите ссылки на него.' : fallback;
}

function formatDate(value) {
    if (typeof value !== 'string') return '—';
    const date = new Date(value);
    return Number.isNaN(date.valueOf()) ? '—' : new Intl.DateTimeFormat('ru-RU', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(date);
}

function createSectionSlug(name, sections) {
    const base = slugifyPageTitle(name) || 'section';
    const usedSlugs = new Set(sections.map(({ slug }) => slug));
    let slug = base;
    let suffix = 2;
    while (usedSlugs.has(slug)) slug = `${base}-${suffix++}`;
    return slug;
}

export default function SiteMaterialsPage() {
    const navigate = useAppNavigate();
    const sectionDialogRef = useRef(null);
    const [filter, setFilter] = useState('all');
    const [materials, setMaterials] = useState([]);
    const [sections, setSections] = useState([]);
    const [sectionId, setSectionId] = useState('');
    const [sectionDialog, setSectionDialog] = useState(null);
    const [sectionName, setSectionName] = useState('');
    const [sectionSaving, setSectionSaving] = useState(false);
    const [sectionError, setSectionError] = useState('');
    const [status, setStatus] = useState('loading');
    const [error, setError] = useState('');
    const [deletingId, setDeletingId] = useState(null);

    useEffect(() => {
        const dialog = sectionDialogRef.current;
        if (!dialog) return;
        if (sectionDialog && !dialog.open) dialog.showModal();
        else if (!sectionDialog && dialog.open) dialog.close();
    }, [sectionDialog]);

    useEffect(() => {
        const controller = new AbortController();
        setStatus('loading');
        setError('');
        Promise.all([
            fetch('/api/site/material-sections', { signal: controller.signal }),
            fetch('/api/site/materials', { signal: controller.signal }),
        ])
            .then(async ([sectionsResponse, materialsResponse]) => {
                if (!sectionsResponse.ok) throw new Error(await responseError(sectionsResponse, 'Не удалось загрузить разделы'));
                if (!materialsResponse.ok) throw new Error(await responseError(materialsResponse, 'Не удалось загрузить материалы'));
                return Promise.all([sectionsResponse.json(), materialsResponse.json()]);
            })
            .then(([sectionResult, materialResult]) => {
                const nextSections = Array.isArray(sectionResult) ? sectionResult : [];
                setSections(nextSections);
                setMaterials(Array.isArray(materialResult) ? materialResult : []);
                setSectionId((current) => current && nextSections.some(({ id }) => id === current) ? current : '');
                setStatus('success');
            })
            .catch((loadError) => {
                if (loadError.name !== 'AbortError') { setError(loadError.message); setStatus('error'); }
            });
        return () => controller.abort();
    }, []);

    const selectedSection = sections.find(({ id }) => id === sectionId);
    const tabs = useMemo(() => [
        { id: '', label: 'Все' },
        ...sections.map(({ id, name }) => ({ id, label: name })),
    ], [sections]);
    const activeTabIndex = Math.max(0, tabs.findIndex(({ id }) => id === sectionId));
    const visibleMaterials = useMemo(
        () => materials.filter((material) =>
            (!sectionId || material.sectionId === sectionId)
            && (filter === 'all' || material.status === filter)
        ),
        [materials, filter, sectionId],
    );

    function openSectionDialog(section = null) {
        setSectionError('');
        setSectionName(section?.name ?? '');
        setSectionDialog({ id: section?.id ?? null });
    }

    function closeSectionDialog() {
        if (sectionSaving) return;
        setSectionDialog(null);
        setSectionError('');
    }

    async function saveSection(event) {
        event.preventDefault();
        const form = event.currentTarget;
        if (!sectionDialog || sectionSaving) return;
        const name = sectionName.trim();
        if (!name) return;
        setSectionSaving(true);
        setSectionError('');
        try {
            const id = sectionDialog.id;
            const body = id
                ? { name }
                : { name, slug: createSectionSlug(name, sections), sortOrder: Math.max(-1, ...sections.map(({ sortOrder }) => sortOrder)) + 1 };
            const response = await apiRequest(id ? `/api/site/material-sections/${id}` : '/api/site/material-sections', {
                method: id ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!response.ok) throw new Error(await formResponseError(response, form, 'Не удалось сохранить раздел. Проверьте название и повторите попытку.'));
            const saved = await response.json();
            setSections((current) => id
                ? current.map((item) => item.id === id ? saved : item)
                : [...current, saved]);
            setSectionId(saved.id);
            setSectionDialog(null);
        } catch (saveError) {
            setSectionError(saveError.message);
        } finally {
            setSectionSaving(false);
        }
    }

    async function deleteSection() {
        const section = sections.find(({ id }) => id === sectionDialog?.id);
        if (!section || sectionSaving || !window.confirm(`Удалить раздел «${section.name}»?`)) return;
        setSectionSaving(true);
        setSectionError('');
        try {
            const response = await apiRequest(`/api/site/material-sections/${section.id}`, { method: 'DELETE' });
            if (!response.ok) throw new Error(await responseError(response, 'Не удалось удалить раздел'));
            setSections((current) => current.filter(({ id }) => id !== section.id));
            setSectionId('');
            setSectionDialog(null);
        } catch (deleteError) {
            setSectionError(deleteError.message);
        } finally {
            setSectionSaving(false);
        }
    }

    async function deleteMaterial(material) {
        if (deletingId || !window.confirm(`Удалить материал «${material.title}»?`)) return;
        setDeletingId(material.id);
        setError('');
        try {
            const response = await apiRequest(`/api/site/materials/${material.id}`, { method: 'DELETE' });
            if (!response.ok) throw new Error(await responseError(response, 'Не удалось удалить материал'));
            setMaterials((current) => current.filter(({ id }) => id !== material.id));
            const sectionsResponse = await fetch('/api/site/material-sections');
            if (sectionsResponse.ok) setSections(await sectionsResponse.json());
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
            status={status}
            isDirty={Boolean(sectionDialog && sectionName !== (sections.find(({ id }) => id === sectionDialog.id)?.name || ''))}
            saveStatus={sectionSaving ? 'saving' : 'idle'}
            errorMessage={error || 'Не удалось загрузить материалы.'}
        >
            <div className={styles.content}>
                <div className={styles.sectionBar}>
                    <div className={styles.tabsViewport}>
                        <Tabs
                            className={styles.sectionTabs}
                            items={tabs}
                            activeIndex={activeTabIndex}
                            ariaLabel="Разделы материалов"
                            onSelect={(_, item) => setSectionId(item.id)}
                        />
                    </div>
                    {selectedSection && <Button variant="iconCompact" title="Редактировать раздел" aria-label={`Редактировать раздел «${selectedSection.name}»`} onClick={() => openSectionDialog(selectedSection)}><Icon name="edit" size={18} /></Button>}
                    <Button variant="iconCompact" title="Создать раздел" aria-label="Создать раздел" onClick={() => openSectionDialog()}><Icon name="add" size={18} /></Button>
                </div>

                <div className={styles.tableToolbar}>
                    <label className={`${fieldStyles.field} ${compactStyles.field} ${compactStyles.compact} ${styles.statusFilter}`}>
                        <span>Статус</span>
                        <select value={filter} onChange={(event) => setFilter(event.target.value)}>
                            {FILTERS.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
                        </select>
                    </label>
                    {selectedSection && <Button variant="primary" size="compact" onClick={() => navigate?.(`/admin/materials/new?sectionId=${encodeURIComponent(selectedSection.id)}`)}><Icon name="add" /> Добавить материал</Button>}
                </div>

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
                                    <td><StatusBadge tone={STATUS_TONES[material.status]}>{STATUS_LABELS[material.status] || material.status}</StatusBadge></td>
                                    <td className={styles.actions}>
                                        <Button variant="compact" title="Редактировать материал" aria-label={`Редактировать материал «${material.title}»`} onClick={() => navigate?.(`/admin/materials/${material.id}`)} disabled={Boolean(deletingId)}><Icon name="edit" /></Button>
                                        <Button variant="compact" title="Удалить материал" aria-label={`Удалить материал «${material.title}»`} onClick={() => deleteMaterial(material)} disabled={Boolean(deletingId)}><Icon name="delete" /></Button>
                                    </td>
                                </tr>)}
                                {!visibleMaterials.length && <tr><td className={styles.empty} colSpan="4">
                                    {!materials.length ? 'Материалов пока нет.' : filter !== 'all' ? 'Материалов с таким статусом нет.' : sectionId ? 'В этом разделе пока нет материалов.' : 'Материалов нет.'}
                                </td></tr>}
                            </tbody>
                        </table>
                    </div>
                </AdminPanel>
            </div>

            <dialog
                ref={sectionDialogRef}
                className={dialogStyles.dialog}
                aria-labelledby="material-section-dialog-title"
                onCancel={(event) => { event.preventDefault(); closeSectionDialog(); }}
            >
                <h2 id="material-section-dialog-title">{sectionDialog?.id ? 'Редактировать раздел' : 'Новый раздел'}</h2>
                <ValidatedForm className={styles.sectionForm} onSubmit={saveSection}>
                    <label className={fieldStyles.field}>
                        <span>Название</span>
                        <input name="name" value={sectionName} onChange={(event) => { setSectionName(event.target.value); setSectionError(''); }} required maxLength="200" autoFocus />
                    </label>
                    {sectionError && <p className={styles.actionError} role="alert">{sectionError}</p>}
                    <div className={styles.sectionFormActions}>
                        {sectionDialog?.id && sections.find(({ id }) => id === sectionDialog.id)?.canDelete === true && <Button className={styles.deleteSectionAction} type="button" variant="danger" onClick={deleteSection} disabled={sectionSaving}>Удалить раздел</Button>}
                        <Button type="button" variant="secondary" onClick={closeSectionDialog} disabled={sectionSaving}>Отмена</Button>
                        <Button type="submit" variant="primary" disabled={sectionSaving}>{sectionSaving ? 'Сохранение…' : 'Сохранить'}</Button>
                    </div>
                </ValidatedForm>
            </dialog>
        </SiteSettingsLayout>
    );
}
