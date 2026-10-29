import { useCallback, useEffect, useRef, useState } from 'react';
import Page from '../layout/Page.jsx';
import SiteRoot from '../layout/SiteRoot.jsx';
import PartEditor from './PartEditor.jsx';
import styles from './EditorWorkspace.module.css';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import Icon from '../components/ui/Icon.jsx';
import barStyles from '../components/ui/AdminBar.module.css';
import PartControls from './PartControls.jsx';
import PartPicker from './PartPicker.jsx';

function StickyPartHeader({ children }) {
    const sentinelRef = useRef(null);
    const headerRef = useRef(null);

    useEffect(() => {
        const sentinel = sentinelRef.current;
        const header = headerRef.current;

        if (!sentinel || !header) return undefined;

        const observer = new IntersectionObserver(([entry]) => {
            header.toggleAttribute(
                'data-stuck',
                !entry.isIntersecting && entry.boundingClientRect.top < 0,
            );
        });

        observer.observe(sentinel);

        return () => observer.disconnect();
    }, []);

    return (
        <>
            <span ref={sentinelRef} className={styles.stickySentinel} aria-hidden="true" />
            <div ref={headerRef} className={`${barStyles.bar} ${barStyles.attached} ${styles.partHeader}`}>
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
    content,
    metadata,
    parts,
    loadStatus,
    theme,
    contacts,
    catalog,
    reviews,
    onAddPart,
    onRemovePart,
    onMovePart,
    onPropChange,
}) {
    const [picker, setPicker] = useState(null);
    const [editingPartId, setEditingPartId] = useState(null);

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
                {content.flatMap((item, index) => [
                    insertionPoint(index, `insertion-${item.id}`),
                    <div
                        className={styles.previewPart}
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
                                        catalog={catalog}
                                        reviews={reviews}
                                        onPropChange={(name, value) => onPropChange(item.id, name, value)}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className={styles.partContent} inert={false}>
                                <SiteRoot theme={theme}>
                                    <Page content={[item]} parts={parts} contacts={contacts} catalog={catalog} reviews={reviews} />
                                </SiteRoot>
                            </div>
                        )}
                    </div>,
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
