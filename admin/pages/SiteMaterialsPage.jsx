import FormError from '../ui/FormError.jsx';
import { Input, Select } from '../ui/NativeControls.jsx';
import { useEffect, useMemo, useState } from 'react';
import Button from '../ui/Button.jsx';
import Tree, { TreeItem, TreeChildren, TreeEmpty } from '../ui/Tree.jsx';
import { AdminListToolbar, AdminListField, Pagination, useListPage } from '../components/AdminList.jsx';
import listStyles from '../components/AdminList.module.css';
import Icon from '../ui/Icon.jsx';
import StatusBadge from '../ui/StatusBadge.jsx';
import SiteSettingsLayout from '../components/SiteSettingsLayout.jsx';
import fieldStyles from '../editor/Field.module.css';
import Modal from '../ui/Modal.jsx';
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
    const result = await response.json().catch(() => ({}));
    return result.error || fallback;
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
    const [filter, setFilter] = useState('all');
    const [search, setSearch] = useState('');
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
    const [collapsedSections, setCollapsedSections] = useState(new Set());

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

    const visibleMaterials = useMemo(
        () => materials.filter((material) =>
            (!sectionId || material.sectionId === sectionId)
            && (filter === 'all' || material.status === filter)
            && `${material.title} ${material.slug}`.toLocaleLowerCase('ru').includes(search.trim().toLocaleLowerCase('ru'))
        ),
        [materials, filter, sectionId, search],
    );
    const page = useListPage(visibleMaterials, `${sectionId}:${filter}:${search}`);

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
            setCollapsedSections((current) => { const next = new Set(current); next.delete(saved.id); return next; });
            setSectionDialog(null);
        } catch (saveError) {
            setSectionError(saveError.message);
        } finally {
            setSectionSaving(false);
        }
    }

    async function deleteSection(section) {
        if (!section || sectionSaving || !window.confirm(`Удалить раздел «${section.name}»?`)) return;
        setSectionSaving(true);
        setError('');
        setSectionError('');
        try {
            const response = await apiRequest(`/api/site/material-sections/${section.id}`, { method: 'DELETE' });
            if (!response.ok) throw new Error(await responseError(response, 'Не удалось удалить раздел'));
            setSections((current) => current.filter(({ id }) => id !== section.id));
            setSectionId('');
            setSectionDialog(null);
        } catch (deleteError) {
            setError(deleteError.message);
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
            list
            status={status}
            isDirty={Boolean(sectionDialog && sectionName !== (sections.find(({ id }) => id === sectionDialog.id)?.name || ''))}
            saveStatus={sectionSaving ? 'saving' : 'idle'}
            errorMessage={error || 'Не удалось загрузить материалы.'}
        >
            <div className={styles.content}>
                <AdminListToolbar actions={<div className={styles.toolbarActions}>
                    <Button size="compact" onClick={() => openSectionDialog()}><Icon name="add" /> Добавить раздел</Button>
                    <Button variant="primary" size="compact" onClick={() => navigate?.(`/admin/materials/new${sectionId ? `?sectionId=${encodeURIComponent(sectionId)}` : ''}`)}><Icon name="add" /> Добавить материал</Button>
                </div>}>
                    <AdminListField label="Раздел"><Select value={sectionId} onChange={(event) => setSectionId(event.target.value)}><option value="">Все разделы</option>{sections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}</Select></AdminListField>
                    <AdminListField label="Поиск"><Input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Название или адрес" /></AdminListField>
                    <AdminListField label="Статус">
                        <Select value={filter} onChange={(event) => setFilter(event.target.value)}>
                            {FILTERS.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
                        </Select>
                    </AdminListField>
                </AdminListToolbar>

                {error && status === 'success' && <p className={listStyles.error} role="alert">{error}</p>}
                <Tree aria-label="Материалы">
                    {sections.filter((section) => !sectionId || section.id === sectionId).map((section) => {
                        const expanded = !collapsedSections.has(section.id);
                        const items = page.items.filter((material) => material.sectionId === section.id);
                        const count = visibleMaterials.filter((material) => material.sectionId === section.id).length;
                        const toggleSection = () => setCollapsedSections((current) => {
                            const next = new Set(current);
                            if (next.has(section.id)) next.delete(section.id); else next.add(section.id);
                            return next;
                        });
                        return <TreeItem key={section.id} label={section.name} title={section.name} folder expanded={expanded}
                            count={count} toggleLabel={`Раздел материалов «${section.name}»`} onToggle={toggleSection} onClick={toggleSection}
                            actions={<>
                                <Button variant="listIcon" title="Добавить материал" aria-label={`Добавить материал в «${section.name}»`} onClick={() => navigate?.(`/admin/materials/new?sectionId=${encodeURIComponent(section.id)}`)}><Icon name="add" size={16} /></Button>
                                <Button variant="listIcon" title="Переименовать раздел" aria-label={`Переименовать раздел «${section.name}»`} onClick={() => openSectionDialog(section)} disabled={sectionSaving}><Icon name="edit" size={16} /></Button>
                                <Button variant="listIcon" title="Удалить раздел" aria-label={`Удалить раздел «${section.name}»`} onClick={() => deleteSection(section)} disabled={sectionSaving}><Icon name="delete" size={16} /></Button>
                            </>}>
                            {expanded && <TreeChildren>
                                {items.length ? <Tree>{items.map((material) => <TreeItem key={material.id}
                                    label={<span className={styles.itemLabel}><span>{material.title}</span><small>/{material.slug}</small><StatusBadge tone={STATUS_TONES[material.status]}>{STATUS_LABELS[material.status] || material.status}</StatusBadge></span>}
                                    title={`${material.title} · /${material.slug} · ${formatDate(material.updatedAt)}`}
                                    href={`/admin/materials/${material.id}`}
                                    actions={<>
                                        <Button variant="listIcon" title="Редактировать материал" aria-label={`Редактировать материал «${material.title}»`} onClick={() => navigate?.(`/admin/materials/${material.id}`)} disabled={Boolean(deletingId)}><Icon name="edit" size={16} /></Button>
                                        <Button variant="listIcon" title="Удалить материал" aria-label={`Удалить материал «${material.title}»`} onClick={() => deleteMaterial(material)} disabled={Boolean(deletingId)}><Icon name="delete" size={16} /></Button>
                                    </>} />)}</Tree> : <TreeEmpty>{count ? 'Материалы этого раздела находятся на других страницах списка.' : search || filter !== 'all' ? 'По заданным условиям ничего не найдено.' : 'В этом разделе пока нет материалов.'}</TreeEmpty>}
                            </TreeChildren>}
                        </TreeItem>;
                    })}
                </Tree>
                {!sections.length && <TreeEmpty>Разделов и материалов пока нет.</TreeEmpty>}
                <Pagination {...page.pagination} />
            </div>

            {sectionDialog && <Modal narrow title={sectionDialog.id ? 'Переименовать раздел' : 'Новый раздел'}
                busy={sectionSaving} onClose={closeSectionDialog} actions={<>
                    <Button onClick={closeSectionDialog} disabled={sectionSaving}>Отмена</Button>
                    <Button type="submit" form="material-section-form" variant="primary" disabled={sectionSaving}>{sectionSaving ? 'Сохранение…' : 'Сохранить'}</Button>
                </>}>
                <ValidatedForm id="material-section-form" className={styles.sectionForm} onSubmit={saveSection}>
                    <label className={fieldStyles.field}>
                        <span>Название</span>
                        <Input name="name" value={sectionName} onChange={(event) => { setSectionName(event.target.value); setSectionError(''); }} required maxLength="200" autoFocus />
                    </label>
                    {sectionError && <FormError>{sectionError}</FormError>}
                </ValidatedForm>
            </Modal>}
        </SiteSettingsLayout>
    );
}
