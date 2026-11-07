import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import ApplicationContext from '@vyaz/core/Context.js';
import Button from '../ui/Button.jsx';
import Switch from '../ui/Switch.jsx';
import AdminPanel from '../ui/AdminPanel.jsx';
import Icon from '../ui/Icon.jsx';
import ImageField from '../editor/ImageField.jsx';
import SiteSettingsLayout from '../components/SiteSettingsLayout.jsx';
import MaterialEditor from '../components/MaterialEditor.jsx';
import { materialRequestBody } from '../editor/materialRequest.mjs';
import compactStyles from '../ui/CompactForm.module.css';
import styles from './SiteMaterialEditorPage.module.css';
import useAutoSlug from '../editor/useAutoSlug.jsx';
import { apiRequest } from '../editor/apiRequest.mjs';
import { formResponseError, showFieldErrors } from '../ui/formValidation.mjs';
import ActionFooter from '../components/ActionFooter.jsx';

const EMPTY_CONTENT = {
    root: {
        type: 'root',
        children: [],
        direction: null,
        format: '',
        indent: 0,
        version: 1,
    },
};

function emptyMaterial() {
    return { sectionId: '', slug: '', title: '', summary: '', content: null, coverMediaId: null, status: 'published' };
}

function mediaIdFromUrl(value) {
    const match = typeof value === 'string' ? value.match(/\/api\/media\/([^/?#]+)/) : null;
    return match?.[1] || null;
}

function hasText(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    if (value.type === 'text' && typeof value.text === 'string' && value.text.trim()) return true;
    return Array.isArray(value.children) && value.children.some(hasText);
}

function materialHasText(content) {
    return Boolean(content?.root && hasText(content.root));
}

async function responseError(response, fallback) {
    return fallback;
}

export function MaterialActions({ materialId, dirty, saveStatus, onDelete }) {
    return <ActionFooter isDirty={dirty} saveStatus={saveStatus}>
        {materialId && <Button type="button" variant="danger" onClick={onDelete} disabled={saveStatus === 'saving'}><Icon name="delete" /> Удалить</Button>}
        <Button type="submit" form="material-form" variant="primary" disabled={!dirty || saveStatus === 'saving'}><Icon name="save" /> Сохранить</Button>
    </ActionFooter>;
}

export default function SiteMaterialEditorPage() {
    const { pathname, search, navigate } = useContext(ApplicationContext) || {};
    const [materialId, setMaterialId] = useState(undefined);
    const [material, setMaterial] = useState(null);
    const [sections, setSections] = useState([]);
    const [savedMaterial, setSavedMaterial] = useState(null);
    const [status, setStatus] = useState('loading');
    const [error, setError] = useState('');
    const [formError, setFormError] = useState('');
    const [saveStatus, setSaveStatus] = useState('idle');
    const revision = useRef(0);
    const skipLoadId = useRef(null);
    const active = useRef(true);
    useEffect(() => {
        active.current = true;
        return () => { active.current = false; };
    }, []);
    const { slug, changeSlug } = useAutoSlug({ title: material?.title || '', value: material?.slug || '', onChange: (value) => updateField('slug', value), enabled: materialId === null, identity: materialId });

    useEffect(() => {
        fetch('/api/site/material-sections').then((response) => response.json()).then((result) => setSections(Array.isArray(result) ? result : [])).catch(() => {});
    }, []);

    useEffect(() => {
        const match = pathname.match(/^\/admin\/materials(?:\/([^/]+))?/);
        const nextId = match?.[1] && match[1] !== 'new' ? match[1] : null;
        setMaterialId(nextId);
    }, [pathname]);

    useEffect(() => {
        if (materialId === undefined) return undefined;
        if (materialId && materialId === skipLoadId.current) {
            skipLoadId.current = null;
            return undefined;
        }
        if (!materialId) {
            const next = { ...emptyMaterial(), sectionId: new URLSearchParams(search).get('sectionId') || '' };
            setMaterial(next);
            setSavedMaterial(next);
            setStatus('success');
            return undefined;
        }

        const controller = new AbortController();
        const loadRevision = revision.current;
        setStatus('loading');
        setError('');
        fetch(`/api/site/materials/${materialId}`, { signal: controller.signal })
            .then(async (response) => {
                if (!response.ok) throw new Error(await responseError(response, 'Не удалось загрузить материал'));
                return response.json();
            })
            .then((result) => {
                if (revision.current !== loadRevision) return;
                setMaterial(result);
                setSavedMaterial(result);
                setStatus('success');
            })
            .catch((loadError) => {
                if (loadError.name !== 'AbortError') {
                    setError(loadError.message);
                    setStatus('error');
                }
            });
        return () => controller.abort();
    }, [materialId, search]);

    const dirty = Boolean(material && savedMaterial && JSON.stringify(material) !== JSON.stringify(savedMaterial));

    useEffect(() => {
        if (!dirty) return undefined;
        const warn = (event) => {
            event.preventDefault();
            event.returnValue = '';
        };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [dirty]);

    function updateField(name, value) {
        revision.current += 1;
        setMaterial((current) => ({ ...current, [name]: value }));
        setFormError('');
        setSaveStatus((current) => current === 'saving' ? current : 'idle');
    }

    async function saveMaterial(event) {
        event?.preventDefault();
        const currentForm = event?.currentTarget || document.getElementById('material-form');
        if (!material || !dirty || saveStatus === 'saving') return;
        const nextStatus = material.status;
        if (nextStatus === 'published' && !materialHasText(material.content)) {
            showFieldErrors(currentForm, { content: 'Добавьте текст материала или выберите статус «Черновик»' });
            setSaveStatus('error');
            return;
        }

        const savedRevision = revision.current;
        setSaveStatus('saving');
        setFormError('');
        const body = materialRequestBody({ ...material, slug }, nextStatus);
        try {
            const response = await apiRequest(materialId ? `/api/site/materials/${materialId}` : '/api/site/materials', {
                method: materialId ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!response.ok) throw new Error(await formResponseError(response, currentForm, 'Не удалось сохранить материал. Проверьте поля и повторите попытку.'));
            const result = await response.json();
            if (!active.current) return;
            setSavedMaterial(result);
            if (revision.current === savedRevision) {
                setMaterial(result);
                setSaveStatus('success');
                navigate?.('/admin/materials', { skipGuard: true });
            } else {
                if (!materialId && result.id) {
                    skipLoadId.current = result.id;
                    setMaterialId(result.id);
                }
                setSaveStatus('idle');
            }
        } catch (saveError) {
            setFormError('Не удалось сохранить материал. Проверьте поля и повторите попытку.');
            setSaveStatus('error');
        }
    }

    async function deleteCurrentMaterial() {
        if (!materialId || !window.confirm(`Удалить материал «${material?.title || ''}»?`)) return;
        try {
            const response = await apiRequest(`/api/site/materials/${materialId}`, { method: 'DELETE' });
            if (!response.ok) throw new Error(await responseError(response, 'Не удалось удалить материал'));
            if (!active.current) return;
            navigate?.('/admin/materials', { skipGuard: true });
        } catch (deleteError) {
            setFormError(deleteError.message);
        }
    }

    const imageUrl = material?.coverMediaId ? `/api/media/${material.coverMediaId}` : '';
    const editorValue = useMemo(() => material?.content || EMPTY_CONTENT, [material?.content]);
    const title = materialId ? 'Редактирование материала' : 'Новый материал';
    const actions = useMemo(() => <Button type="button" variant="secondary" aria-label="К списку материалов" onClick={() => navigate?.('/admin/materials')}><Icon name="back" /> <span>К списку</span></Button>, [navigate]);

    return (
        <SiteSettingsLayout
            section="materials"
            title={title}
            actions={actions}
            status={status}
            errorMessage={error || 'Не удалось загрузить материал.'}
            isDirty={dirty}
            saveStatus={saveStatus}
        >
            {material && <AdminPanel as="form" id="material-form" className={styles.form} onSubmit={saveMaterial}>
                <fieldset className={styles.fields} disabled={!materialId && saveStatus === 'saving'}>
                <div className={styles.heading}>
                    <p>{materialId ? 'Изменения сохраняются только после явного действия.' : 'Сначала сохраните черновик, чтобы открыть постоянный адрес материала.'}</p>
                </div>
                <label className={`${compactStyles.field} ${compactStyles.compact}`}>
                    <span>Раздел</span>
                    <select name="sectionId" value={material.sectionId || ''} onChange={(event) => updateField('sectionId', event.target.value)} required>
                        <option value="">Выберите раздел</option>
                        {sections.map((section) => <option value={section.id} key={section.id}>{section.name}</option>)}
                    </select>
                </label>
                <label className={`${compactStyles.field} ${compactStyles.compact}`}>
                    <span>Заголовок</span>
                    <input name="title" value={material.title} onChange={(event) => updateField('title', event.target.value)} required maxLength="300" autoFocus />
                </label>
                <label className={`${compactStyles.field} ${compactStyles.compact}`}>
                    <span>Slug</span>
                    <input name="slug" value={slug} onChange={(event) => changeSlug(event.target.value)} required maxLength="200" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" />
                </label>
                <label className={`${compactStyles.field} ${compactStyles.long}`}>
                    <span>Краткое описание</span>
                    <textarea name="summary" rows="3" value={material.summary ?? ''} onChange={(event) => updateField('summary', event.target.value)} maxLength="2000" />
                </label>
                <div className={`${compactStyles.field} ${compactStyles.long} ${styles.coverField}`}>
                    <span>Обложка</span>
                    <ImageField
                        label=""
                        name="coverMediaId"
                        value={imageUrl}
                        maxWidth={1600}
                        onChange={(url) => updateField('coverMediaId', mediaIdFromUrl(url))}
                    />
                    {imageUrl && <Button type="button" variant="compact" onClick={() => updateField('coverMediaId', null)}><Icon name="delete" /> Удалить обложку</Button>}
                </div>
                <div className={styles.editorField}>
                    <span className={styles.editorLabel}>Текст материала</span>
                    <MaterialEditor value={editorValue} onChange={(content) => updateField('content', content)} disabled={saveStatus === 'saving'} />
                </div>
                <Switch label="Показывать на сайте" checked={material.status === 'published'} onChange={(event) => updateField('status', event.target.checked ? 'published' : 'draft')} />
                </fieldset>
                {formError && <p className={styles.formError} role="alert">{formError}</p>}
            </AdminPanel>}
            <MaterialActions materialId={materialId} dirty={dirty} saveStatus={saveStatus} onDelete={deleteCurrentMaterial} />
        </SiteSettingsLayout>
    );
}
