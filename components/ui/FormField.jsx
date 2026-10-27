import styles from './FormField.module.css';
import compactStyles from './CompactForm.module.css';

export default function FormField({ label, help, children, compact = false, className = '' }) {
    return (
        <label className={`${styles.field} ${compact ? `${compactStyles.field} ${compactStyles.compact}` : ''} ${className}`}>
            <span className={styles.label}>{label}</span>
            {children}
            {help && <small className={styles.help}>{help}</small>}
        </label>
    );
}
