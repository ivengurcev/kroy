import AdminHeader from './AdminHeader.jsx';
import styles from './AdminPageShell.module.css';
import theme from './AdminTheme.module.css';
import Card from './ui/Card.jsx';

export default function AdminPageShell({
    title,
    actions,
    status = 'success',
    errorMessage,
    children,
}) {
    return (
        <div className={`${theme.theme} ${styles.shell}`}>
            <header className={styles.header}>
                <AdminHeader mode="pages" />
                <Card className={styles.sectionBar}>
                    <h1>{title}</h1>
                    <div className={styles.actions}>{actions}</div>
                </Card>
            </header>

            <main className={styles.content}>
                {status === 'loading' && <p className={styles.status} role="status">Загрузка…</p>}
                {status === 'error' && <p className={styles.status} role="alert">{errorMessage}</p>}
                {status === 'success' && children}
            </main>
        </div>
    );
}
