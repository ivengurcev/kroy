import AdminHeader from './AdminHeader.jsx';
import EditorWorkspace from '../../editor/EditorWorkspace.jsx';
import styles from './AdminShell.module.css';
import theme from '../../styles/AdminTheme.module.css';

export default function AdminShell({
    page,
    content,
    metadata,
    parts,
    loadStatus,
    saveStatus,
    isDirty,
    onAddPart,
    onRemovePart,
    onMovePart,
    onPropChange,
    onSave,
}) {
    return (
        <div className={`${theme.theme} ${styles.adminShell}`}>
            <header className={styles.header}>
                <AdminHeader
                    page={page}
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
                    loadStatus={loadStatus}
                    onAddPart={onAddPart}
                    onRemovePart={onRemovePart}
                    onMovePart={onMovePart}
                    onPropChange={onPropChange}
                />
            </main>
        </div>
    );
}
