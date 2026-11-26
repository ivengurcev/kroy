import { useCallback, useEffect, useRef, useState } from 'react';
import Page from '../../site/runtime/Page.jsx';
import { SiteTheme } from '../../site/runtime/SiteRoot.jsx';
import { availableFooterPages, projectHeader } from '../../shared/footerSettings.mjs';
import PartEditor from './PartEditor.jsx';
import styles from './EditorWorkspace.module.css';
import Card from '../ui/Card.jsx';
import Button from '../ui/Button.jsx';
import Icon from '../ui/Icon.jsx';
import PartControls from './PartControls.jsx';
import PartPicker from './PartPicker.jsx';
import AdminPanel from '../ui/AdminPanel.jsx';

function StickyPartHeader({ children }) {
    const sentinelRef = useRef(null);
    const headerRef = useRef(null);

    useEffect(() => {
        const sentinel = sentinelRef.current;
        const header = headerRef.current;
        const panel = header?.parentElement;
        const main = header?.closest('main');

        if (!sentinel || !header || !panel || !main) return undefined;

        let observer;
        const update = () => {
            const panelLeft = panel.getBoundingClientRect().left + panel.clientLeft;
            const mainLeft = main.getBoundingClientRect().left;
            header.style.setProperty('--admin-sticky-breakout-left', `${Math.max(0, panelLeft - mainLeft)}px`);
            header.style.setProperty('--admin-sticky-main-left', `${mainLeft}px`);
            header.style.setProperty('--admin-sticky-viewport-width', `${document.documentElement.clientWidth}px`);
            observer?.disconnect();
            const style = getComputedStyle(header);
            const offset = parseFloat(style.top);
            observer = new IntersectionObserver(([entry]) => {
                header.toggleAttribute('data-stuck', !entry.isIntersecting);
            }, { rootMargin: `-${offset}px 0px 0px 0px` });
            observer.observe(sentinel);
        };
        const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
        resizeObserver?.observe(header);
        resizeObserver?.observe(panel);
        resizeObserver?.observe(main);
        window.addEventListener('resize', update);
        update();

        return () => {
            observer?.disconnect();
            resizeObserver?.disconnect();
            window.removeEventListener('resize', update);
        };
    }, []);

    return (
        <>
            <span ref={sentinelRef} className={styles.stickySentinel} aria-hidden="true" />
            <div ref={headerRef} className={styles.partHeader}>
                {children}
            </div>
        </>
    );
}

function partTitle(identifier, metadata) {
    return metadata[identifier]?.title
        || identifier.split('/').at(-1).replaceAll('-', ' ');
}

export default function EditorWorkspace({
    page,
    content,
    metadata,
    parts,
    widgets,
    widgetMetadata,
    loadStatus,
    theme,
    contacts,
    footer,
    footerPreview,
    sharedBefore = [],
    sharedAfter = [],
    templateName,
    linkPages = [],
    siteName,
    globalTheme,
    catalog,
    reviews,
    materialSections,
    preview,
    onAddPart,
    onRemovePart,
    onMovePart,
    onPropChange,
    onViewChange,
    onViewPropChange,
    onFooterChange,
    onSharedPropChange,
}) {
    const [picker, setPicker] = useState(null);
    const [editingPartId, setEditingPartId] = useState(null);
    const editingPartRef = useRef(null);
    useEffect(() => {
        if (!editingPartId) return undefined;
        const frame = requestAnimationFrame(() => {
            editingPartRef.current?.scrollIntoView({
                behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
                block: 'start',
            });
        });
        return () => cancelAnimationFrame(frame);
    }, [editingPartId]);
    const record = page?.type === 'detail' ? preview?.record : null;
    const context = { siteName, params: record && page.routeParam ? { [page.routeParam]: record.slug } : {} };
    const previewMessage = page?.type === 'detail' && {
        loading: 'Загрузка материала для предпросмотра…',
        empty: 'Нет опубликованных материалов для предпросмотра. Опубликуйте материал в настройках сайта.',
        error: 'Не удалось загрузить материал для предпросмотра.',
    }[preview?.status] || page?.type === 'list' && page.dataSource === 'materials' && {
        loading: 'Загрузка материалов для предпросмотра…',
        error: 'Не удалось загрузить список материалов для предпросмотра.',
    }[preview?.status];

    const closePicker = useCallback((restoreFocus = true) => {
        setPicker((current) => {
            if (restoreFocus && current?.anchor) {
                requestAnimationFrame(() => current.anchor.focus());
            }

            return null;
        });
    }, []);

    if (loadStatus !== 'success') {
        return (
            <Card className={styles.workspaceStatus} role={loadStatus === 'error' ? 'alert' : undefined}>
                {loadStatus === 'loading'
                    ? 'Загрузка страницы…'
                    : 'Не удалось загрузить страницу.'}
            </Card>
        );
    }

    function openPicker(event, position) {
        event.preventDefault();
        event.stopPropagation();

        const anchor = event.currentTarget;

        setPicker((current) => current?.anchor === anchor ? null : { anchor, position });
    }

    function selectPartType(part) {
        onAddPart(part, picker.position);
        closePicker(false);
    }

    function editPart(id) {
        setEditingPartId(id);
    }

    function closePartEditor() {
        setEditingPartId(null);
    }

    function removePart(id) {
        if (editingPartId === id) setEditingPartId(null);
        onRemovePart(id);
    }

    function insertionPoint(position, key) {
        return (
            <div className={styles.insertionPoint} data-editor-control key={key}>
                <Button variant="compact" title="Добавить запчасть в эту позицию" onClick={(event) => openPicker(event, position)}>
                    <Icon name="add" size={17} /> Добавить запчасть
                </Button>
            </div>
        );
    }

    const eligible = availableFooterPages(linkPages);
    function renderBlock(item, index, kind) {
        if (item.slot) return <Card key={item.id}>Содержимое страницы</Card>;
        const own = kind === 'own';
        const isFooter = kind === 'footer';
        const notice = isFooter ? 'Общий элемент сайта. Изменения затронут все страницы сайта'
            : own ? undefined : `Общий элемент шаблона. Изменения затронут все страницы, использующие шаблон „${templateName}“`;
        const fields = metadata[item.part]?.fields ?? {};
        const displayed = isFooter ? { ...item, props: footerPreview } : projectHeader(item, eligible);
        const canEdit = metadata[item.part] && (own || isFooter || Object.keys(fields).length);
        return <AdminPanel
                        ref={item.id === editingPartId ? editingPartRef : undefined}
                        className={styles.previewPart}
                        noPadding
                        key={item.id}
                    >
                        <StickyPartHeader>
                            <span className={styles.partHeading}>
                                <b className={styles.partTitle}>{partTitle(item.part, metadata)}</b>
                                <code className={styles.partCode}>{item.part}</code>
                            </span>
                            <PartControls
                                className={styles.partControls}
                                partId={item.id}
                                isFirst={index === 0}
                                isLast={index === content.length - 1}
                                isEditing={item.id === editingPartId}
                                onEdit={canEdit ? editPart : undefined}
                                onClose={closePartEditor}
                                onMove={own ? onMovePart : undefined}
                                onRemove={own ? removePart : undefined}
                                notice={notice}
                            />
                        </StickyPartHeader>
                        {item.id === editingPartId && metadata[item.part] ? (
                            <div className={styles.inlineEditor}>
                                <div className={styles.inlineEditorBody}>
                                    <PartEditor
                                        key={item.id}
                                        title={partTitle(item.part, metadata)}
                                        props={item.props}
                                        fields={fields}
                                        part={item.part}
                                        pages={linkPages}
                                        propsOnly={!own}
                                        onPropsChange={isFooter ? onFooterChange : undefined}
                                        partContract={metadata[item.part]?.contract}
                                        view={item.view}
                                        widgetMetadata={widgetMetadata}
                                        catalog={catalog}
                                        reviews={reviews}
                    materialSections={materialSections}
                                        onPropChange={(name, value) => (own ? onPropChange : onSharedPropChange)(item.id, name, value)}
                                        onViewChange={(name) => onViewChange(item.id, name)}
                                        onViewPropChange={(name, value) => onViewPropChange(item.id, name, value)}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className={styles.partContent} inert={false}>
                                 <SiteTheme theme={own ? theme : globalTheme}>
                                     <Page content={[displayed]} parts={parts} widgets={widgets} contacts={contacts} catalog={catalog} reviews={reviews} materials={preview?.materials} materialSectionId={page?.materialSectionId} record={record} context={context} />
                                 </SiteTheme>
                            </div>
                        )}
                    </AdminPanel>;
    }

    return (
        <div className={styles.workspace}>
            <section className={styles.pageCanvas} aria-label="Предпросмотр страницы">
                {previewMessage && <Card className={styles.workspaceMessage} role={preview.status === 'error' ? 'alert' : 'status'}>{previewMessage}</Card>}
                {sharedBefore.map((item, index) => renderBlock(item, index, 'shared'))}
                {content.flatMap((item, index) => [
                    insertionPoint(index, `insertion-${item.id}`),
                    renderBlock(item, index, 'own'),
                ])}
                {insertionPoint(content.length, 'insertion-last')}
                {sharedAfter.map((item, index) => renderBlock(item, index, 'shared'))}
                {footer && renderBlock(footer, 0, 'footer')}
            </section>

            {picker && (
                <PartPicker
                    anchor={picker.anchor}
                    metadata={metadata}
                    onClose={closePicker}
                    onSelect={selectPartType}
                />
            )}
        </div>
    );
}
