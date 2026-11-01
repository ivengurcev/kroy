import { useEffect, useMemo, useRef, useState } from 'react';
import Button from '../ui/Button.jsx';
import Card from '../ui/Card.jsx';
import Icon from '../ui/Icon.jsx';
import ImageField from '../editor/ImageField.jsx';
import SiteSettingsLayout from '../components/SiteSettingsLayout.jsx';
import MaterialEditor from '../components/MaterialEditor.jsx';
import compactStyles from '../ui/CompactForm.module.css';
import styles from './SiteMaterialEditorPage.module.css';

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
    return { sectionId: '', slug: '', title: '', summary: '', content: null, coverMediaId: null, status: 'draft' };
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
    const result = await response.json().catch(() => ({}));
    return result.error || `${fallback}: ${response.status}`;
}

export default function SiteMaterialEditorPage() {
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

    useEffect(() => {
        fetch('/api/site/material-sections').then((response) => response.json()).then((result) => setSections(Array.isArray(result) ? result : [])).catch(() => {});
    }, []);

    useEffect(() => {
        const match = window.location.pathname.match(/^\/admin\/site\/materials(?:\/([^/]+))?/);
        const nextId = match?.[1] && match[1] !== 'new' ? match[1] : null;
        setMaterialId(nextId);
    }, []);

    useEffect(() => {
        if (materialId === undefined) return undefined;
        if (materialId && materialId === skipLoadId.current) {
            skipLoadId.current = null;
            return undefined;
        }
        if (!materialId) {
            const next = { ...emptyMaterial(), sectionId: new URLSearchParams(window.location.search).get('sectionId') || '' };
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
    }, [materialId]);

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

    function changeSection(nextSection) {
        if (nextSection === 'catalog') window.location.assign('/admin/site/catalog');
        else if (nextSection === 'reviews') window.location.assign('/admin/site/reviews');
        else if (nextSection !== 'materials') window.location.assign(`/admin/site?section=${encodeURIComponent(nextSection)}`);
    }

    function updateField(name, value) {
        revision.current += 1;
        setMaterial((current) => ({ ...current, [name]: value }));
        setFormError('');
        setSaveStatus((current) => current === 'saving' ? current : 'idle');
    }

    async function saveMaterial(event, requestedStatus = null) {
        event?.preventDefault();
        if (!material || saveStatus === 'saving') return;
        const nextStatus = requestedStatus || material.status;
        if (nextStatus === 'published' && !materialHasText(material.content)) {
            setFormError('Для публикации добавьте непустой текст материала.');
            return;
        }

        const savedRevision = revision.current;
        setSaveStatus('saving');
        setFormError('');
        const body = { ...material, status: nextStatus };
        delete body.id;
        delete body.createdAt;
        delete body.updatedAt;
        delete body.publishedAt;
        try {
            const response = await fetch(materialId ? `/api/site/materials/${materialId}` : '/api/site/materials', {
                method: materialId ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!response.ok) throw new Error(await responseError(response, 'Не удалось сохранить материал'));
            const result = await response.json();
            setSavedMaterial(result);
            if (revision.current === savedRevision) {
                setMaterial(result);
                setSaveStatus('success');
            } else {
                setSaveStatus('idle');
            }
            if (!materialId && result.id) {
                skipLoadId.current = result.id;
                window.history.replaceState({}, '', `/admin/site/materials/${result.id}`);
                setMaterialId(result.id);
            }
        } catch (saveError) {
            setFormError(saveError.message);
            setSaveStatus('idle');
        }
    }

    async function deleteCurrentMaterial() {
        if (!materialId || !window.confirm(`Удалить материал «${material?.title || ''}»?`)) return;
        try {
            const response = await fetch(`/api/site/materials/${materialId}`, { method: 'DELETE' });
            if (!response.ok) throw new Error(await responseError(response, 'Не удалось удалить материал'));
            window.location.assign('/admin/site/materials');
        } catch (deleteError) {
            setFormError(deleteError.message);
        }
    }

    const imageUrl = material?.coverMediaId ? `/api/media/${material.coverMediaId}` : '';
    const editorValue = useMemo(() => material?.content || EMPTY_CONTENT, [material?.content]);
    const title = materialId ? 'Редактирование материала' : 'Новый материал';

    return (
        <SiteSettingsLayout
            section="materials"
            title={title}
            status={status}
            errorMessage={error || 'Не удалось загрузить материал.'}
            isDirty={dirty}
            saveStatus={saveStatus}
            onSave={() => saveMaterial()}
            onSectionChange={changeSection}
        >
            {material && <Card as="form" className={styles.form} onSubmit={saveMaterial}>
                <div className={styles.heading}>
                    <div>
                        <h2>{title}</h2>
                        <p>{materialId ? 'Изменения сохраняются только после явного действия.' : 'Сначала сохраните черновик, чтобы открыть постоянный адрес материала.'}</p>
                    </div>
                    <Button type="button" variant="secondary" onClick={() => window.location.assign('/admin/site/materials')}><Icon name="back" /> К списку</Button>
                </div>
                <label className={`${compactStyles.field} ${compactStyles.compact}`}>
                    <span>Раздел</span>
                    <select value={material.sectionId || ''} onChange={(event) => updateField('sectionId', event.target.value)} required>
                        <option value="">Выберите раздел</option>
                        {sections.map((section) => <option value={section.id} key={section.id}>{section.name}</option>)}
                    </select>
                    <span>Заголовок</span>
                    <input value={material.title} onChange={(event) => updateField('title', event.target.value)} required maxLength="300" autoFocus />
                </label>
                <label className={`${compactStyles.field} ${compactStyles.compact}`}>
                    <span>Slug</span>
                    <input value={material.slug} onChange={(event) => updateField('slug', event.target.value)} required maxLength="200" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" />
                </label>
                <label className={`${compactStyles.field} ${compactStyles.long}`}>
                    <span>Краткое описание</span>
                    <textarea rows="3" value={material.summary ?? ''} onChange={(event) => updateField('summary', event.target.value)} maxLength="2000" />
                </label>
                <div className={`${compactStyles.field} ${compactStyles.long} ${styles.coverField}`}>
                    <span>Обложка</span>
                    <ImageField
                        label=""
                        value={imageUrl}
                        aspectRatio="16:9"
                        maxWidth={1600}
                        onChange={(url) => updateField('coverMediaId', mediaIdFromUrl(url))}
                    />
                    {imageUrl && <Button type="button" variant="compact" onClick={() => updateField('coverMediaId', null)}><Icon name="delete" /> Удалить обложку</Button>}
                </div>
                <div className={styles.editorField}>
                    <span className={styles.editorLabel}>Текст материала</span>
                    <MaterialEditor value={editorValue} onChange={(content) => updateField('content', content)} disabled={saveStatus === 'saving'} />
                </div>
                <label className={`${compactStyles.field} ${compactStyles.compact}`}>
                    <span>Статус</span>
                    <select value={material.status} onChange={(event) => updateField('status', event.target.value)}>
                        <option value="draft">Черновик</option>
                        <option value="published">Опубликована</option>
                    </select>
                </label>
                {formError && <p className={styles.formError} role="alert">{formError}</p>}
                <div className={styles.actions}>
                    {materialId && <Button type="button" variant="danger" onClick={deleteCurrentMaterial} disabled={saveStatus === 'saving'}><Icon name="delete" /> Удалить</Button>}
                    <span className={styles.actionSpacer} />
                    <Button type="submit" variant="secondary" disabled={saveStatus === 'saving'}><Icon name="save" /> {saveStatus === 'saving' ? 'Сохранение…' : 'Сохранить'}</Button>
                    <Button type="button" variant="primary" disabled={saveStatus === 'saving'} onClick={() => saveMaterial(undefined, 'published')}><Icon name="publish" /> Опубликовать</Button>
                </div>
            </Card>}
        </SiteSettingsLayout>
    );
}
