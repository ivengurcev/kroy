import { useEffect, useMemo, useRef, useState } from 'react';
import EditorWorkspace from '../editor/EditorWorkspace.jsx';
import PageDetailsDialog from './PageDetailsDialog.jsx';
import Button from '../ui/Button.jsx';
import Icon from '../ui/Icon.jsx';
import { useAdminHeader } from './AdminWorkspaceContext.jsx';
import styles from './AdminShell.module.css';
import ActionFooter from './ActionFooter.jsx';
import { useAppNavigate } from './AdminWorkspaceContext.jsx';
import { apiRequest } from '../editor/apiRequest.mjs';

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
    const [detailsDirty, setDetailsDirty] = useState(false);
    const [deleteError, setDeleteError] = useState('');
    const [deleting, setDeleting] = useState(false);
    const navigate = useAppNavigate();
    const active = useRef(true);
    useEffect(() => {
        active.current = true;
        return () => { active.current = false; };
    }, []);
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
    useAdminHeader({ mode: 'editor', title, page, loadStatus, saveStatus, isDirty: isDirty || detailsDirty, onSave, onPageDetailsChange });

    async function deletePage() {
        if (!page.id || page.path === '/' || deleting || !window.confirm(`Удалить страницу «${page.title}»?`)) return;
        setDeleting(true);
        setDeleteError('');
        try {
            const response = await apiRequest(`/api/pages/${page.id}`, { method: 'DELETE' });
            if (!response.ok) throw new Error();
            if (active.current) navigate?.('/admin/pages', { skipGuard: true });
        } catch {
            setDeleteError('Не удалось удалить страницу. Повторите попытку.');
        } finally { setDeleting(false); }
    }

    function closePageDetails() {
        setDetailsOpen(false);
        setDetailsDirty(false);
        requestAnimationFrame(() => detailsButtonRef.current?.focus());
    }

    return (
        <div className={styles.shell}>
                <div className={styles.actions}>{actions}</div>
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
                {detailsOpen && <PageDetailsDialog page={page} onDirtyChange={setDetailsDirty} onSaved={(updatedPage) => { onPageDetailsChange(updatedPage); closePageDetails(); }} onCancel={closePageDetails} />}
                {deleteError && <p role="alert">{deleteError}</p>}
                {loadStatus === 'success' && <ActionFooter isDirty={isDirty} saveStatus={saveStatus}>
                    {page.id && page.path !== '/' && <Button variant="danger" disabled={deleting || saveStatus === 'saving'} onClick={deletePage}><Icon name="delete" /> Удалить</Button>}
                    <Button variant="primary" disabled={!isDirty || deleting || saveStatus === 'saving'} onClick={onSave}><Icon name="save" /> Сохранить</Button>
                </ActionFooter>}
        </div>
    );
}
