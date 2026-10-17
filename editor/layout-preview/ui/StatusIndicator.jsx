import styles from './StatusIndicator.module.css';

export default function StatusIndicator({ title, details, className = '' }) {
    return (
        <span className={`${styles.status} ${className}`}>
            <i>✓</i>
            <span><b>{title}</b>{details && <small>{details}</small>}</span>
        </span>
    );
}
