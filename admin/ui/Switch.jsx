import styles from './Switch.module.css';

export default function Switch({ label, checked, onChange, disabled, name, className = '' }) {
    return <label className={`${styles.switch} ${className}`}>
        <input type="checkbox" role="switch" name={name} checked={checked} onChange={onChange} disabled={disabled} />
        <span className={styles.track} aria-hidden="true" />
        <span>{label}</span>
    </label>;
}
