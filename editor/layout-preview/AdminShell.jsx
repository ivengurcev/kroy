import AdminHeader from './AdminHeader.jsx';
import EditorFooter from './EditorFooter.jsx';
import EditorToolbar from './EditorToolbar.jsx';
import EditorWorkspace from './EditorWorkspace.jsx';
import styles from './AdminShell.module.css';
import theme from './AdminTheme.module.css';

export default function AdminShell({
    page,
    content,
    metadata,
    parts,
    selectedPartId,
    loadStatus,
    saveStatus,
    isDirty,
    onSelectPart,
    onAddPart,
    onRemovePart,
    onMovePart,
    onPropChange,
    onSave,
}) {
    return (
        <div className={`${theme.theme} ${styles.adminShell}`}>
            <header className={styles.header}>
                <AdminHeader page={page} isDirty={isDirty} />
                <EditorToolbar
                    loadStatus={loadStatus}
                    saveStatus={saveStatus}
                    isDirty={isDirty}
                    onSave={onSave}
                />
            </header>
            <main className={styles.scrollArea}>
                <EditorWorkspace
                    content={content}
                    metadata={metadata}
                    parts={parts}
                    selectedPartId={selectedPartId}
                    loadStatus={loadStatus}
                    onSelectPart={onSelectPart}
                    onAddPart={onAddPart}
                    onRemovePart={onRemovePart}
                    onMovePart={onMovePart}
                    onPropChange={onPropChange}
                />
            </main>
            <EditorFooter />
        </div>
    );
}
