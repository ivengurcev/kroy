import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import EditorWorkspace from '../editor/EditorWorkspace.jsx';
import AdminPageHeader from './AdminPageHeader.jsx';
import PageDetailsDialog from './PageDetailsDialog.jsx';
import Button from '../ui/Button.jsx';
import Icon from '../ui/Icon.jsx';
import { useAdminHeader } from './AdminWorkspaceContext.jsx';
import styles from './AdminShell.module.css';

const useMeasuredLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

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
    const headerRef = useRef(null);
    const [headerHeight, setHeaderHeight] = useState(null);
    useAdminHeader({ mode: 'editor', page, loadStatus, saveStatus, isDirty, onSave, onPageDetailsChange });

    useMeasuredLayoutEffect(() => {
        const header = headerRef.current;
        if (!header) return undefined;
        const updateHeaderHeight = () => setHeaderHeight(header.getBoundingClientRect().height);
        if (typeof ResizeObserver === 'undefined') {
            window.addEventListener('resize', updateHeaderHeight);
            updateHeaderHeight();
            return () => window.removeEventListener('resize', updateHeaderHeight);
        }
        const observer = new ResizeObserver(updateHeaderHeight);
        observer.observe(header);
        updateHeaderHeight();
        return () => observer.disconnect();
    }, []);

    function closePageDetails() {
        setDetailsOpen(false);
        requestAnimationFrame(() => detailsButtonRef.current?.focus());
    }

    return (
        <div className={styles.shell} style={{ '--admin-page-header-height': headerHeight ? `${headerHeight}px` : undefined }}>
                <AdminPageHeader
                    headerRef={headerRef}
                    title={page.title || 'Редактор страницы'}
                    actions={<Button
                        ref={detailsButtonRef}
                        variant="secondary"
                        disabled={loadStatus !== 'success' || !page.id}
                        aria-label="Настройки страницы"
                        title="Настройки страницы"
                        onClick={() => setDetailsOpen(true)}
                    ><Icon name="settings" /> Настройки страницы</Button>}
                />
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
