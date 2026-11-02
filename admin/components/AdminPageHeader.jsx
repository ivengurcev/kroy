import styles from './AdminPageHeader.module.css';

export default function AdminPageHeader({ title, actions, children }) {
    return (
        <div className={styles.heading}>
            <div className={styles.titleGroup}>
                <h1>{title}</h1>
                {children}
            </div>
            {actions && <div className={styles.actions}>{actions}</div>}
        </div>
    );
}
