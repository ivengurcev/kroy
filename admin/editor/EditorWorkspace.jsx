import { useCallback, useEffect, useRef, useState } from 'react';
import Page from '../../site/runtime/Page.jsx';
import SiteRoot from '../../site/runtime/SiteRoot.jsx';
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
            const panelLeft = panel.getBoundingClientRect().left;
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
}) {
    const [picker, setPicker] = useState(null);
    const [editingPartId, setEditingPartId] = useState(null);
    const record = page?.type === 'detail' ? preview?.record : null;
    const context = { params: record && page.routeParam ? { [page.routeParam]: record.slug } : {} };
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

    return (
        <div className={styles.workspace}>
            <section className={styles.pageCanvas} aria-label="Предпросмотр страницы">
                {previewMessage && <Card className={styles.workspaceMessage} role={preview.status === 'error' ? 'alert' : 'status'}>{previewMessage}</Card>}
                {content.flatMap((item, index) => [
                    insertionPoint(index, `insertion-${item.id}`),
                    <AdminPanel
                        className={styles.previewPart}
                        noPadding
                        key={item.id}
                    >
                        <StickyPartHeader>
                            <b className={styles.partTitle}>{partTitle(item.part, metadata)}</b>
                            <PartControls
                                className={styles.partControls}
                                partId={item.id}
                                isFirst={index === 0}
                                isLast={index === content.length - 1}
                                isEditing={item.id === editingPartId}
                                onEdit={editPart}
                                onClose={closePartEditor}
                                onMove={onMovePart}
                                onRemove={removePart}
                            />
                        </StickyPartHeader>
                        {item.id === editingPartId ? (
                            <div className={styles.inlineEditor}>
                                <div className={styles.inlineEditorBody}>
                                    <PartEditor
                                        title={partTitle(item.part, metadata)}
                                        props={item.props}
                                        fields={metadata[item.part]?.fields ?? {}}
                                        partContract={metadata[item.part]?.contract}
                                        view={item.view}
                                        widgetMetadata={widgetMetadata}
                                        catalog={catalog}
                                        reviews={reviews}
                    materialSections={materialSections}
                                        onPropChange={(name, value) => onPropChange(item.id, name, value)}
                                        onViewChange={(name) => onViewChange(item.id, name)}
                                        onViewPropChange={(name, value) => onViewPropChange(item.id, name, value)}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className={styles.partContent} inert={false}>
                                <SiteRoot theme={theme}>
                                    <Page content={[item]} parts={parts} widgets={widgets} contacts={contacts} catalog={catalog} reviews={reviews} materials={preview?.materials} materialSectionId={page?.materialSectionId} record={record} context={context} />
                                </SiteRoot>
                            </div>
                        )}
                    </AdminPanel>,
                ])}
                {insertionPoint(content.length, 'insertion-last')}
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
