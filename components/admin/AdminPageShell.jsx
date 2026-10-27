import AdminHeader from './AdminHeader.jsx';
import AdminLayout from './AdminLayout.jsx';
import styles from './AdminLayout.module.css';
import Card from '../ui/Card.jsx';

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
    return (
        <AdminLayout header={(
            <>
                <AdminHeader mode={headerMode} title={title} isDirty={isDirty} saveStatus={saveStatus} loadStatus={status} onSave={onSave} />
                {headerMode !== 'site' && <Card className={styles.sectionBar}>
                    <h1>{title}</h1>
                    <div className={styles.actions}>{actions}</div>
                </Card>}
            </>
            )}>
                {status === 'loading' && <p className={styles.status} role="status">Загрузка…</p>}
                {status === 'error' && <p className={styles.status} role="alert">{errorMessage}</p>}
                {status === 'success' && children}
        </AdminLayout>
    );
}
