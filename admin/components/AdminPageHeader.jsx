import styles from './AdminPageHeader.module.css';

export default function AdminPageHeader({ title, compact = false }) {
    return (
        <h1 className={compact ? styles.compact : styles.heading} title={title}>{title}</h1>
    );
}
