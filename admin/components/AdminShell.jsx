import { useMemo, useRef, useState } from 'react';
import EditorWorkspace from '../editor/EditorWorkspace.jsx';
import PageDetailsDialog from './PageDetailsDialog.jsx';
import Button from '../ui/Button.jsx';
import Icon from '../ui/Icon.jsx';
import { useAdminHeader } from './AdminWorkspaceContext.jsx';
import styles from './AdminShell.module.css';

export default function AdminShell({
    page,
    content,
    metadata,
    parts,
    widgets,
    widgetMetadata,
    loadStatus,
    saveStatus,
    isDirty,
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
    onSave,
    onPageDetailsChange,
}) {
    const [detailsOpen, setDetailsOpen] = useState(false);
    const detailsButtonRef = useRef(null);
    const title = page.title || 'Редактор страницы';
    const actions = useMemo(() => <Button
        ref={detailsButtonRef}
        variant="secondary"
        disabled={loadStatus !== 'success' || !page.id}
        aria-label="Настройки страницы"
        title="Настройки страницы"
        onClick={() => setDetailsOpen(true)}
    ><Icon name="settings" /><span> Настройки страницы</span></Button>, [loadStatus, page.id]);
    useAdminHeader({ mode: 'editor', title, actions, page, loadStatus, saveStatus, isDirty, onSave, onPageDetailsChange });

    function closePageDetails() {
        setDetailsOpen(false);
        requestAnimationFrame(() => detailsButtonRef.current?.focus());
    }

    return (
        <div className={styles.shell}>
                <EditorWorkspace
                    page={page}
                    content={content}
                    metadata={metadata}
                    parts={parts}
                    widgets={widgets}
                    widgetMetadata={widgetMetadata}
                    loadStatus={loadStatus}
                    theme={theme}
                    contacts={contacts}
                    catalog={catalog}
                    reviews={reviews}
                    materialSections={materialSections}
                    preview={preview}
                    onAddPart={onAddPart}
                    onRemovePart={onRemovePart}
                    onMovePart={onMovePart}
                    onPropChange={onPropChange}
                    onViewChange={onViewChange}
                    onViewPropChange={onViewPropChange}
                />
                {detailsOpen && <PageDetailsDialog page={page} onSaved={(updatedPage) => { onPageDetailsChange(updatedPage); closePageDetails(); }} onCancel={closePageDetails} />}
        </div>
    );
}
