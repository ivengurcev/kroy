import FormError from '../ui/FormError.jsx';
import { Input } from '../ui/NativeControls.jsx';
import { useEffect, useRef, useState } from 'react';
import Button from '../ui/Button.jsx';
import Icon from '../ui/Icon.jsx';
import styles from './PageDetailsForm.module.css';
import compactStyles from '../ui/CompactForm.module.css';
import ValidatedForm from '../ui/ValidatedForm.jsx';
import { formResponseError, fieldValidationMessage } from '../ui/formValidation.mjs';
import { apiRequest } from '../editor/apiRequest.mjs';
import Tabs from '../ui/Tabs.jsx';
import SeoFields from './SeoFields.jsx';
import PageAppearanceFields from './PageAppearanceFields.jsx';
import useAutoSlug from '../editor/useAutoSlug.jsx';
import { SelectControl } from '../ui/TokenControls.jsx';

function joinClasses(...classes) {
    return classes.filter(Boolean).join(' ');
}

function errorMessage(status) {
    if (status === 400) return 'Проверьте название и путь страницы.';
    if (status === 409) return 'Страница с таким путём уже существует.';
    return 'Не удалось изменить страницу.';
}

export default function PageDetailsForm({
    page,
    onSaved,
    onCancel,
    onDirtyChange,
    onErrorChange,
    onSubmittingChange,
    showError = true,
    cancelFirst = false,
    handleEscape = true,
    className = '',
    pathClassName = '',
    titleClassName = '',
    actionsClassName = '',
    formId,
    hideActions = false,
    onSaveStatusChange,
    onAppearancePreview,
}) {
    const isNew = !page.id;
    const [type, setType] = useState(page.type || 'standard');
    const [title, setTitle] = useState(page.title);
    const [path, setPath] = useState(page.path);
    const [routeParam, setRouteParam] = useState(page.routeParam || 'slug');
    const [dataSource, setDataSource] = useState(page.dataSource || 'materials');
    const [materialSectionId, setMaterialSectionId] = useState(page.materialSectionId || '');
    const [sections, setSections] = useState([]);
    const [seo, setSeo] = useState(page.seo ?? {});
    const [appearance, setAppearance] = useState(page.appearance ?? {});
    const [siteData, setSiteData] = useState(null);
    const [tab, setTab] = useState(0);
    const [status, setStatus] = useState('idle');
    const [error, setError] = useState('');
    const { slug: generatedPath, changeSlug } = useAutoSlug({ title, value: path, onChange: setPath, prefix: '/', maxLength: Infinity, enabled: isNew });
    const pathInputRef = useRef(null);
    const titleInputRef = useRef(null);
    const isMainPage = !isNew && page.path === '/';
    const isDetail = page.type === 'detail';
    const isDirty = (isNew && Boolean(title || path || type !== 'standard')) || title !== page.title || (isDetail ? routeParam !== (page.routeParam || 'slug') : path !== page.path)
        || (page.type === 'list' && (dataSource !== (page.dataSource || 'materials') || materialSectionId !== (page.materialSectionId || '')))
        || JSON.stringify(seo) !== JSON.stringify(page.seo ?? {})
        || JSON.stringify(appearance) !== JSON.stringify(page.appearance ?? {});
    const isSubmitting = status === 'submitting';
    const saveButton = (
        <Button type="submit" variant="primary" title="Сохранить изменения страницы" disabled={!isDirty || isSubmitting}>
            <Icon name="save" /> {isSubmitting ? 'Сохранение…' : 'Сохранить'}
        </Button>
    );
    const cancelButton = (
        <Button title="Отменить изменение страницы" disabled={isSubmitting} onClick={cancel}>
            <Icon name="close" /> Отмена
        </Button>
    );

    useEffect(() => {
        const controller = new AbortController();
        fetch('/api/site/settings', { signal: controller.signal }).then((response) => {
            if (!response.ok) throw new Error();
            return response.json();
        }).then(setSiteData).catch((error) => { if (error.name !== 'AbortError') setFormError('Не удалось загрузить наследуемые SEO-настройки.'); });
        return () => controller.abort();
    }, [page.id]);

    useEffect(() => {
        if (type === 'list') fetch('/api/site/material-sections').then((response) => response.json()).then((result) => setSections(Array.isArray(result) ? result : [])).catch(() => {});
    }, [page.id, type]);

    useEffect(() => {
        setTitle(page.title);
        setPath(page.path);
        setRouteParam(page.routeParam || 'slug');
        setDataSource(page.dataSource || 'materials');
        setMaterialSectionId(page.materialSectionId || '');
        setSeo(page.seo ?? {});
        setAppearance(page.appearance ?? {});
        setError('');
    }, [page.id, page.title, page.path, page.routeParam, page.dataSource, page.materialSectionId, page.seo, page.appearance]);

    useEffect(() => {
        onDirtyChange?.(isDirty);
    }, [isDirty, onDirtyChange]);

    useEffect(() => {
        onSubmittingChange?.(isSubmitting);
    }, [isSubmitting, onSubmittingChange]);

    useEffect(() => {
        onSaveStatusChange?.(status === 'submitting' ? 'saving' : status);
    }, [status, onSaveStatusChange]);

    useEffect(() => {
        const frame = requestAnimationFrame(() => {
            (isMainPage ? titleInputRef : pathInputRef).current?.focus();
        });

        return () => cancelAnimationFrame(frame);
    }, [isMainPage, page.id]);

    function setFormError(message) {
        setError(message);
        onErrorChange?.(message);
    }

    function cancel() {
        if (isSubmitting) return;
        setTitle(page.title);
        setPath(page.path);
        setType(page.type || 'standard');
        setRouteParam(page.routeParam || 'slug');
        setDataSource(page.dataSource || 'materials');
        setMaterialSectionId(page.materialSectionId || '');
        setSeo(page.seo ?? {});
        setAppearance(page.appearance ?? {});
        setStatus('idle');
        setFormError('');
        onCancel?.();
    }

    function handleKeyDown(event) {
        if (!handleEscape || event.key !== 'Escape') return;

        event.preventDefault();
        event.stopPropagation();
        cancel();
    }

    async function submit(event) {
        event.preventDefault();
        const form = event.currentTarget;

        if (!isDirty || isSubmitting) return;

        setStatus('submitting');
        setFormError('');

        try {
            const response = await apiRequest(isNew ? '/api/pages' : `/api/pages/${page.id}`, {
                method: isNew ? 'POST' : 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(isNew
                    ? { title, path: generatedPath, type, dataSource: type === 'list' ? dataSource : null, materialSectionId: type === 'list' && dataSource === 'materials' ? materialSectionId : null }
                    : isDetail ? { title, routeParam, appearance } : { ...(page.type === 'list' ? { title, path, dataSource, materialSectionId: dataSource === 'materials' ? materialSectionId : null } : isMainPage ? { title } : { title, path }), seo, appearance }),
            });

            if (!response.ok) {
                setStatus('error');
                const result = await response.clone().json().catch(() => ({}));
                const names = Object.keys(result.fields ?? {});
                if (names.length) {
                    setTab(names[0].startsWith('appearance') ? 2 : names[0].startsWith('seo.') ? 1 : 0);
                    requestAnimationFrame(() => form.querySelector('[aria-invalid="true"]')?.focus());
                }
                setFormError(await formResponseError(response, form, errorMessage(response.status)));
                return;
            }

            onSaved(await response.json());
            setStatus('success');
        } catch {
            setStatus('error');
            setFormError(errorMessage());
        }
    }

    return (
        <ValidatedForm id={formId} inert={isSubmitting || undefined} className={joinClasses(styles.form, className)} onReset={(event) => { event.preventDefault(); cancel(); }} onInput={() => { if (!isSubmitting) setStatus('idle'); }} onSubmitCapture={(event) => {
            const invalid = [...event.currentTarget.elements].find((field) => field.closest(`.${styles.basic}`) && !field.disabled && fieldValidationMessage(field));
            if (invalid) { setTab(0); requestAnimationFrame(() => invalid.focus()); }
        }} onSubmit={submit} onKeyDown={handleEscape ? handleKeyDown : undefined}>
            <Tabs items={[{ label: 'Основное' }, { label: 'SEO', disabled: isDetail || isNew }, { label: 'Внешний вид', disabled: isNew }]} activeIndex={tab} onSelect={setTab} ariaLabel="Разделы настроек страницы" />
            <div hidden={tab !== 0} className={styles.basic}>
            <label className={joinClasses(styles.field, compactStyles.field, compactStyles.compact)}>
                <span>Тип страницы</span>
                <SelectControl name="type" label="Тип страницы" value={type} disabled={!isNew || isSubmitting} onChange={setType}
                    options={[{ value: 'standard', label: 'Обычная' }, { value: 'list', label: 'Список' }, { value: 'detail', label: 'Детальный шаблон', disabled: true }]} />
            </label>
            {type === 'list' && <><label className={joinClasses(styles.field, compactStyles.field, compactStyles.compact)}>
                <span>Источник данных</span>
                <SelectControl label="Источник данных" value={dataSource} onChange={(value) => { setDataSource(value); if (value !== 'materials') setMaterialSectionId(''); }}
                    options={[{ value: 'materials', label: 'Материалы' }, { value: 'products', label: 'Товары' }, { value: 'reviews', label: 'Отзывы' }]} />
            </label>{dataSource === 'materials' && <label className={joinClasses(styles.field, compactStyles.field, compactStyles.compact)}>
                <span>Раздел материалов</span><SelectControl name="materialSectionId" label="Раздел материалов" value={materialSectionId} onChange={setMaterialSectionId} required
                    options={[{ value: '', label: 'Выберите раздел' }, ...sections.map((item) => ({ value: item.id, label: item.name }))]} />
            </label>}</>}
            <label className={joinClasses(styles.field, compactStyles.field, compactStyles.compact, pathClassName)}>
                <span>{isDetail ? 'Параметр пути' : 'Путь'}</span>
                <Input
                    name={isDetail ? 'routeParam' : 'path'}
                    required
                    ref={pathInputRef}
                    value={isDetail ? routeParam : isNew ? generatedPath : path}
                    disabled={isMainPage || isSubmitting}
                    onChange={(event) => isDetail ? setRouteParam(event.target.value) : isNew ? changeSlug(event.target.value) : setPath(event.target.value)}
                />
            </label>
            <label className={joinClasses(styles.field, compactStyles.field, compactStyles.compact, titleClassName)}>
                <span>Название</span>
                <Input
                    name="title"
                    required
                    ref={titleInputRef}
                    value={title}
                    disabled={isSubmitting}
                    onChange={(event) => setTitle(event.target.value)}
                />
            </label>
            </div>
            {!isDetail && <div hidden={tab !== 1}><SeoFields value={seo} onChange={setSeo} siteData={siteData} page={{ ...page, title }} /></div>}
            {!isNew && <div hidden={tab !== 2}><PageAppearanceFields value={appearance} onPreviewChange={onAppearancePreview} onChange={(next) => { setAppearance(next); setStatus('idle'); setFormError(''); }} /></div>}
            {!hideActions && <div className={joinClasses(styles.actions, actionsClassName)}>
                {cancelFirst ? <>{cancelButton}{saveButton}</> : <>{saveButton}{cancelButton}</>}
            </div>}
            {showError && error && (
                <FormError>{error}</FormError>
            )}
        </ValidatedForm>
    );
}
