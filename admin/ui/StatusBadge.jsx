import styles from './StatusBadge.module.css';

export default function StatusBadge({ children, tone = 'success' }) {
    return <span className={`${styles.badge} ${styles[tone] ?? styles.success}`}>{children}</span>;
}
