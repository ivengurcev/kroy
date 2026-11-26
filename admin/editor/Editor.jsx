
import { useContext, useEffect, useRef, useState } from 'react';
import ApplicationContext from '@vyaz/core/Context.js';

import { parts } from '../../dist/kroy/parts.mjs';
import metadata from '../../dist/kroy/parts.json';
import { widgets } from '../../dist/kroy/widgets.mjs';
import widgetMetadata from '../../dist/kroy/widgets.json';

import AdminShell from '../components/AdminShell.jsx';
import Button from '../ui/Button.jsx';
import FormField from '../ui/FormField.jsx';
import { SelectControl } from '../ui/TokenControls.jsx';
import fieldStyles from '../components/PageDetailsForm.module.css';
import listStyles from '../components/AdminList.module.css';
import { createPart, changePartView } from '../../shared/partModel.js';
import { toEditorPage } from './pageDetails.mjs';
import { loadMaterialPreview, shouldLoadMaterialPreview } from './materialPreview.mjs';
import { apiRequest, readApiError } from './apiRequest.mjs';
import { FOOTER_PART } from '../../shared/pageTemplates.mjs';
import { footerBlock, prepareSiteFooter } from '../../shared/footerSettings.mjs';

const addEditorIds = (content) => content.map(({ part, props, view }) => createPart(part, metadata[part], widgetMetadata, props, view));
const slot = { id: 'page-content-slot', slot: true };
const readLayout = (layout) => ({ ...layout, content: addEditorIds(layout.content) });
const readTemplateDocument = (layout) => {
    const items = addEditorIds(layout.content);
    items.splice(layout.slotIndex, 0, slot);
    return items;
};
const selectionFrom = (page) => ({ mode: page.templateMode ?? 'inherit', id: page.templateId ?? null });
const equalSelection = (a, b) => a.mode === b.mode && a.id === b.id;

async function read(url, signal) {
    const response = await fetch(url, { signal, cache: 'no-store' });
    if (!response.ok) throw await readApiError(response);
    return response.json();
}

export default function Editor() {
    const { pathname, navigate } = useContext(ApplicationContext) || {};
    const [content, setContent] = useState([]);
    const [page, setPage] = useState({ id: null, title: '', path: '' });
    const [loadStatus, setLoadStatus] = useState('loading');
    const [saveStatus, setSaveStatus] = useState('idle');
    const [saveError, setSaveError] = useState(null);
    const [theme, setTheme] = useState();
    const [pageThemes, setPageThemes] = useState({});
    const [appearancePreview, setAppearancePreview] = useState(null);
    const [contacts, setContacts] = useState();
    const [footer, setFooter] = useState();
    const [site, setSite] = useState();
    const [linkPages, setLinkPages] = useState([]);
    const [layoutList, setLayoutList] = useState();
    const [selection, setSelection] = useState({ mode: 'inherit', id: null });
    const [layout, setLayout] = useState(null);
    const [switching, setSwitching] = useState(false);
    const [name, setName] = useState('');
    const [catalog, setCatalog] = useState();
    const [reviews, setReviews] = useState();
    const [materialSections, setMaterialSections] = useState([]);
    const [preview, setPreview] = useState({ status: 'idle', record: null });
    const saved = useRef({});
    const switchingRequest = useRef(null);
    const templateId = pathname?.match(/^\/admin\/templates\/([^/]+)$/)?.[1];
    const isTemplate = Boolean(templateId);

    useEffect(() => {
        const controller = new AbortController();
        setLoadStatus('loading');
        setAppearancePreview(null);
        const match = pathname.match(
            /^\/admin\/pages\/([^/]+)$/
        );
        const pageUrl = isTemplate ? `/api/templates/${encodeURIComponent(templateId)}` : match
            ? `/api/pages/${encodeURIComponent(match[1])}`
            : '/api/pages?path=/';

        async function loadPage() {
            try {
                const [page, settings, list, references] = await Promise.all([
                    read(pageUrl, controller.signal),
                    read('/api/site/settings', controller.signal),
                    isTemplate ? null : read('/api/templates', controller.signal),
                    read('/api/pages', controller.signal),
                ]);
                const selected = selectionFrom(page);
                const initialLayout = !isTemplate && page.effectiveTemplateId
                    ? readLayout(await read(`/api/templates/${page.effectiveTemplateId}`, controller.signal)) : null;
                const loadedContent = isTemplate ? readTemplateDocument(page) : addEditorIds(page.content);
                if (controller.signal.aborted) return;

                setContent(loadedContent);
                setPage(isTemplate ? { id: page.id, title: page.name } : toEditorPage(page));
                setName(page.name ?? '');
                setSite({ ...settings.site, domains: settings.domains });
                setContacts(settings.contacts);
                setLinkPages(references);
                setFooter(settings.footer.props);
                setLayoutList(list);
                setLayout(initialLayout);
                setSelection(selected);
                saved.current = {
                    content: loadedContent, footer: settings.footer, selection: selected,
                    selectedLayout: initialLayout, layout: initialLayout, name: page.name, version: page.version,
                };
                if (page.path === '/' && pathname !== '/admin') {
                    navigate?.('/admin', { replace: true, skipGuard: true });
                }
                setSaveStatus('success');
                setLoadStatus('success');
            } catch (error) {
                if (error.name !== 'AbortError') {
                    setLoadStatus('error');
                }
            }
        }

        loadPage();

        return () => {
            controller.abort();
            switchingRequest.current?.abort();
        };
    }, [pathname, navigate, isTemplate, templateId]);

    useEffect(() => {
        const controller = new AbortController();

        fetch('/api/site/preview', { signal: controller.signal })
            .then(async (response) => {
                if (!response.ok) throw new Error('Не удалось загрузить тему сайта.');
                return response.json();
            })
            .then(({ theme: nextTheme, pages = {}, detailTemplates = [], catalog: nextCatalog, reviews: nextReviews, materialSections: nextMaterialSections }) => {
                setTheme(nextTheme);
                setPageThemes(Object.fromEntries([...Object.values(pages), ...detailTemplates].filter(({ theme }) => theme).map(({ path, theme }) => [path, theme])));
                setCatalog(nextCatalog);
                setReviews(nextReviews);
                setMaterialSections(nextMaterialSections ?? []);
            })
            .catch((error) => {
                if (error.name !== 'AbortError') setTheme(undefined);
            });

        return () => controller.abort();
    }, []);

    useEffect(() => {
        if (!shouldLoadMaterialPreview(page, loadStatus)) {
            setPreview({ status: 'idle', record: null });
            return undefined;
        }

        const controller = new AbortController();
        setPreview({ status: 'loading', record: null });
        loadMaterialPreview(page, controller.signal)
            .then((sample) => {
                if (!controller.signal.aborted) setPreview(sample);
            })
            .catch((error) => {
                if (error.name !== 'AbortError') setPreview({ status: 'error', record: null });
            });
        return () => controller.abort();
    }, [loadStatus, page.id, page.path, page.type, page.dataSource, page.detailParentId]);

    const pageContent = content.filter((item) => !item.slot).map(({ part, props, view }) => ({
        part, props, view: { name: view.name, props: view.props },
    }));
    const documentDirty = content !== saved.current.content || (isTemplate && name !== saved.current.name);
    const footerDirty = footer !== saved.current.footer?.props;
    const templateDirty = layout !== saved.current.layout;
    const selectionDirty = !equalSelection(selection, saved.current.selection ?? selection);
    const isDirty = loadStatus === 'success' && (documentDirty || footerDirty || templateDirty || selectionDirty);

    function markDirty() {
        setSaveStatus((current) => current === 'saving' ? current : 'idle');
    }

    async function selectTemplate(value) {
        const next = ['inherit', 'none'].includes(value) ? { mode: value, id: null } : { mode: 'template', id: value };
        const effective = next.mode === 'inherit' ? layoutList.defaultTemplateId : next.id;
        if ((layout?.id ?? null) === effective) {
            setSelection(next);
            markDirty();
            return;
        }
        if (templateDirty && !window.confirm('Сбросить несохранённые изменения текущего шаблона?')) return;
        const controller = new AbortController();
        switchingRequest.current?.abort();
        switchingRequest.current = controller;
        setSwitching(true);
        try {
            const nextLayout = effective ? readLayout(await read(`/api/templates/${effective}`, controller.signal)) : null;
            if (controller.signal.aborted) return;
            saved.current.layout = nextLayout;
            setLayout(nextLayout);
            setSelection(next);
            setSaveError(null);
            markDirty();
        } catch (error) {
            if (!controller.signal.aborted) setSaveError(error);
        } finally {
            if (!controller.signal.aborted) setSwitching(false);
        }
    }

    function cancel() {
        const base = saved.current;
        setContent(base.content);
        setName(base.name ?? '');
        setFooter(base.footer.props);
        setSelection(base.selection);
        base.layout = base.selectedLayout;
        setLayout(base.selectedLayout);
        setSaveError(null);
        setSaveStatus('idle');
    }

    async function reloadConflict() {
        const code = saveError?.code;
        const message = code === 'save_unknown'
            ? 'Итог сохранения неизвестен. Перезагрузить редактор и показать сохранённую версию?'
            : 'Загрузить актуальные данные и сбросить конфликтующие правки?';
        if (!window.confirm(message)) return;
        if (code === 'save_unknown') {
            window.location.reload();
            return;
        }
        setSwitching(true);
        try {
            if (code === 'footer_conflict') {
                const settings = await read('/api/site/settings');
                saved.current.footer = settings.footer;
                setFooter(settings.footer.props);
            } else if (isTemplate) {
                const next = await read(`/api/templates/${templateId}`);
                const nextContent = readTemplateDocument(next);
                Object.assign(saved.current, { content: nextContent, version: next.version, name: next.name });
                setContent(nextContent);
                setName(next.name);
                setPage((current) => ({ ...current, title: next.name }));
            } else if (code === 'template_conflict' && layout) {
                const next = readLayout(await read(`/api/templates/${layout.id}`));
                saved.current.layout = next;
                if (saved.current.selectedLayout?.id === next.id) saved.current.selectedLayout = next;
                setLayout(next);
            } else {
                const [next, list] = await Promise.all([read(`/api/pages/${page.id}`), read('/api/templates')]);
                const nextLayout = next.effectiveTemplateId ? readLayout(await read(`/api/templates/${next.effectiveTemplateId}`)) : null;
                const nextSelection = selectionFrom(next);
                Object.assign(saved.current, { layout: nextLayout, selectedLayout: nextLayout, selection: nextSelection });
                setLayout(nextLayout);
                setSelection(nextSelection);
                setLayoutList(list);
            }
            setSaveError(null);
            setSaveStatus('idle');
        } catch (error) {
            setSaveError(Object.assign(error, { code }));
        } finally {
            setSwitching(false);
        }
    }

    async function savePage() {
        if (!page.id || !isDirty || saveStatus === 'saving' || switching || saveError?.code) return;
        const base = saved.current;
        const payload = {};
        if (documentDirty) {
            payload.content = pageContent;
            if (isTemplate) Object.assign(payload, { name, slotIndex: content.indexOf(slot), expectedVersion: base.version });
        }
        if (footerDirty) payload.footerChanges = { props: footer, expectedVersion: base.footer.version };
        if (selectionDirty) payload.templateSelection = selection;
        if (templateDirty) {
            payload.templateChanges = {
                id: layout.id, expectedVersion: base.layout.version,
                propsByIndex: Object.fromEntries(layout.content.flatMap(({ props }, index) =>
                    props === base.layout.content[index].props ? [] : [[index, props]])),
            };
        }
        if (selectionDirty || templateDirty) {
            payload.expectedSelection = base.selection;
            if (selection.mode === 'inherit') payload.expectedDefaultTemplateId = layout?.id ?? layoutList.defaultTemplateId;
        }
        setSaveStatus('saving');
        setSaveError(null);

        try {
            const response = await apiRequest(`/api/${isTemplate ? 'templates' : 'pages'}/${page.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                throw await readApiError(response);
            }

            const result = await response.json();
            base.content = content;
            base.selection = selection;
            if (isTemplate) {
                base.version = result.version;
                base.name = result.name;
                setName(result.name);
                setPage((current) => ({ ...current, title: result.name }));
            }
            const nextLayout = result.template ? { ...layout, version: result.template.version } : layout;
            base.selectedLayout = nextLayout;
            base.layout = nextLayout;
            setLayout(nextLayout);
            if (result.footer) {
                base.footer = result.footer;
                setFooter(result.footer.props);
            }
            setSaveStatus('success');
        } catch (error) {
            if (!error.status) error.code = 'save_unknown';
            if (error.status === 404) error.code = 'selection_conflict';
            setSaveError(error);
            setSaveStatus('error');
        }
    }

    function addPart(part, position) {
        const newPart = createPart(part, metadata[part], widgetMetadata);

        markDirty();
        setContent((previous) => {
            const insertionIndex = Math.max(0, Math.min(position, previous.length));

            return [
                ...previous.slice(0, insertionIndex),
                newPart,
                ...previous.slice(insertionIndex),
            ];
        });
    }

    function removePart(id) {
        if (!content.some((item) => !item.slot && item.id === id)) return;

        const nextContent = content.filter((item) => item.id !== id);

        markDirty();
        setContent(nextContent);
    }

    function movePart(id, direction) {
        const index = content.findIndex((item) => item.id === id);
        const target = index + direction;

        if (index === -1 || target < 0 || target >= content.length) return;

        const nextContent = [...content];

        [nextContent[index], nextContent[target]] = [
            nextContent[target],
            nextContent[index],
        ];

        markDirty();
        setContent(nextContent);
    }

    function updateProp(id, name, value) {
        markDirty();
        setContent((previous) =>
            previous.map((item) =>
                item.id === id
                    ? {
                        ...item,
                        props: {
                            ...item.props,
                            [name]: value,
                        },
                    }
                    : item
            )
        );
    }

    function changeView(id, name) {
        markDirty();
        setContent((previous) => previous.map((item) => {
            if (item.id !== id) return item;
            return changePartView(item, name, metadata[item.part], widgetMetadata);
        }));
    }

    function updateViewProp(id, name, value) {
        markDirty();
        setContent((previous) => previous.map((item) => item.id === id
            ? {
                ...item,
                view: {
                    ...item.view,
                    props: {
                        ...item.view.props,
                        [name]: value,
                    },
                },
            }
            : item));
    }

    function updatePageDetails(updatedPage) {
        if (updatedPage.theme) setPageThemes((current) => {
            const next = { ...current };
            delete next[page.path];
            if (Object.keys(updatedPage.appearance ?? {}).length) next[updatedPage.path] = updatedPage.theme;
            return next;
        });
        setPage(toEditorPage(updatedPage));
    }

    return (
        <>
        {saveError && <div className={listStyles.error}>
            <p role="alert">{saveError.message}</p>
            {saveError.code && <Button disabled={switching} onClick={reloadConflict}>Загрузить актуальные данные</Button>}
        </div>}
        <div inert={saveStatus === 'saving' || switching || undefined} aria-busy={saveStatus === 'saving' || switching}>
        <AdminShell
            page={page}
            content={content}
            metadata={metadata}
            parts={parts}
            widgets={widgets}
            widgetMetadata={widgetMetadata}
            loadStatus={loadStatus}
            saveStatus={saveStatus}
            isDirty={isDirty}
            theme={appearancePreview || pageThemes[page.path] ? { ...theme, ...(appearancePreview ?? pageThemes[page.path]) } : theme}
            contacts={contacts}
            footer={footer && { id: FOOTER_PART, ...footerBlock(footer) }}
            globalTheme={theme}
            catalog={catalog}
            reviews={reviews}
            materialSections={materialSections}
            preview={preview}
            onAddPart={addPart}
            onRemovePart={removePart}
            onMovePart={movePart}
            onPropChange={updateProp}
            onViewChange={changeView}
            onViewPropChange={updateViewProp}
            onSave={savePage}
            saveBlocked={Boolean(saveError?.code)}
            onCancel={cancel}
            isTemplate={isTemplate}
            editorSettings={isTemplate ? <FormField label="Название шаблона" className={fieldStyles.field}>
                <input value={name} maxLength={100} onChange={(event) => { setName(event.target.value); markDirty(); }} />
            </FormField> : layoutList && <FormField label="Использовать шаблон" className={fieldStyles.field}>
                <SelectControl label="Использовать шаблон" value={selection.id ?? selection.mode}
                    disabled={switching || saveStatus === 'saving'} onChange={selectTemplate} options={[
                        { value: 'inherit', label: `Наследовать шаблон сайта (${layoutList.templates.find(({ id }) => id === layoutList.defaultTemplateId)?.name})` },
                        ...layoutList.templates.map(({ id, name }) => ({ value: id, label: name })),
                        { value: 'none', label: 'Без шаблона' },
                    ]} />
            </FormField>}
            workspaceSettings={{
                footerPreview: footer && site ? prepareSiteFooter(site, footer, linkPages.map((page) => ({ ...page, site_id: site.id }))) : undefined,
                sharedBefore: layout?.content.slice(0, layout.slotIndex),
                sharedAfter: layout?.content.slice(layout.slotIndex),
                templateName: layout?.name, linkPages, siteName: site?.name,
                onFooterChange: (props) => { setFooter(props); markDirty(); },
                onSharedPropChange: (id, name, value) => {
                    setLayout((current) => ({ ...current, content: current.content.map((block) =>
                        block.id === id ? { ...block, props: { ...block.props, [name]: value } } : block) }));
                    markDirty();
                },
            }}
            onPageDetailsChange={updatePageDetails}
            onPageAppearancePreview={setAppearancePreview}
        />
        </div>
        </>
    );
}
