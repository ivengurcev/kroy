import styles from './AdminPageHeader.module.css';

export default function AdminPageHeader({ title }) {
    return (
        <h1 className={styles.heading} title={title}>{title}</h1>
    );
}
