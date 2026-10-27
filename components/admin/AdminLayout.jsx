import styles from './AdminLayout.module.css';
import theme from '../../styles/AdminTheme.module.css';

export default function AdminLayout({ header, children }) {
    return (
        <div className={`${theme.theme} ${styles.layout}`}>
            <header className={styles.header}>{header}</header>
            <main className={styles.content}>{children}</main>
        </div>
    );
}
