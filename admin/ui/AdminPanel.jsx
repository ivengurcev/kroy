import Card from './Card.jsx';
import styles from './AdminPanel.module.css';

export default function AdminPanel({ title, actions, noPadding = false, className = '', children, ...props }) {
    return (
        <Card className={`${styles.panel} ${noPadding ? styles.noPadding : ''} ${className}`} {...props}>
            {(title || actions) && (
                <div className={styles.header}>
                    {title && <h2>{title}</h2>}
                    {actions && <div className={styles.actions}>{actions}</div>}
                </div>
            )}
            {children}
        </Card>
    );
}
