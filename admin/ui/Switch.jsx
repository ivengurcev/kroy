import styles from './Switch.module.css';

export default function Switch({ label, checked, onChange, disabled }) {
    return <label className={styles.switch}>
        <input type="checkbox" role="switch" checked={checked} onChange={onChange} disabled={disabled} />
        <span className={styles.track} aria-hidden="true" />
        <span>{label}</span>
    </label>;
}
