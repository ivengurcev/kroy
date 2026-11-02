import styles from './AdminPageShell.module.css';
import AdminPageHeader from './AdminPageHeader.jsx';
import { useAdminHeader } from './AdminWorkspaceContext.jsx';

export default function AdminPageShell({
    title,
    actions,
    status = 'success',
    errorMessage,
    headerMode = 'pages',
    isDirty = false,
    saveStatus = 'idle',
    onSave,
    children,
}) {
    useAdminHeader({ mode: headerMode, title, isDirty, loadStatus: status, saveStatus, onSave });

    return (
        <div className={styles.page}>
            <AdminPageHeader title={title} actions={actions} />
            {status === 'loading' && <p className={styles.status} role="status">Загрузка…</p>}
            {status === 'error' && <p className={styles.status} role="alert">{errorMessage}</p>}
            {status === 'success' && children}
        </div>
    );
}
