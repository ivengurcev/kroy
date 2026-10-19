import styles from './StatusIndicator.module.css';

const icons = {
    error: '!',
    progress: '…',
    success: '✓',
    warning: '•',
};

export default function StatusIndicator({ title, details, tone = 'success', className = '' }) {
    return (
        <span className={`${styles.status} ${styles[tone]} ${className}`} aria-live="polite">
            <i>{icons[tone]}</i>
            <span><b>{title}</b>{details && <small>{details}</small>}</span>
        </span>
    );
}
