import styles from './FormField.module.css';

export default function FormField({ label, help, children }) {
    return (
        <label className={styles.field}>
            <span className={styles.label}>{label}</span>
            {children}
            {help && <small className={styles.help}>{help}</small>}
        </label>
    );
}
