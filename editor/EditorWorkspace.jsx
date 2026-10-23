import { useCallback, useState } from 'react';
import Page from '../layout/Page.jsx';
import SiteRoot from '../layout/SiteRoot.jsx';
import PartEditor from './PartEditor.jsx';
import styles from './EditorWorkspace.module.css';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import Icon from '../components/ui/Icon.jsx';
import PartControls from './PartControls.jsx';
import PartPicker from './PartPicker.jsx';

export default function EditorWorkspace({
    content,
    metadata,
    parts,
    selectedPartId,
    loadStatus,
    onSelectPart,
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

    function selectPart(event, id) {
        if (event.target.closest?.('[data-editor-control]')) return;

        onSelectPart(id);
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
        onSelectPart(id);
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
                <Button variant="compact" onClick={(event) => openPicker(event, position)}>
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
                        className={`${styles.previewPart} ${item.id === selectedPartId ? styles.selectedPart : ''} ${item.id === editingPartId ? styles.editingPart : ''}`}
                        onClickCapture={(event) => selectPart(event, item.id)}
                        key={item.id}
                    >
                        {item.id === editingPartId ? (
                            <div className={styles.editingHeader}>
                                <b className={styles.editingTitle}>{item.part}</b>
                                <PartControls
                                    className={styles.partControls}
                                    partId={item.id}
                                    isFirst={index === 0}
                                    isLast={index === content.length - 1}
                                    isEditing
                                    onEdit={editPart}
                                    onClose={closePartEditor}
                                    onMove={onMovePart}
                                    onRemove={removePart}
                                />
                            </div>
                        ) : (
                            <PartControls
                                className={styles.partControls}
                                partId={item.id}
                                isFirst={index === 0}
                                isLast={index === content.length - 1}
                                onEdit={editPart}
                                onMove={onMovePart}
                                onRemove={removePart}
                            />
                        )}
                        {item.id === editingPartId ? (
                            <div className={styles.inlineEditor}>
                                <div className={styles.inlineEditorBody}>
                                    <PartEditor
                                        part={item.part}
                                        props={item.props}
                                        fields={metadata[item.part]?.fields ?? {}}
                                        onPropChange={(name, value) => onPropChange(item.id, name, value)}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className={styles.partContent} inert="">
                                <SiteRoot>
                                    <Page content={[item]} parts={parts} />
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
