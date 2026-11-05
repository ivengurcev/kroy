import styles from './Table.module.css';

export default function Table({ children, ...props }) {
    return <div className={styles.viewport}><table className={styles.table} {...props}>{children}</table></div>;
}
