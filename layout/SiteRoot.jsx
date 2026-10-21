import styles from '../styles/SiteTheme.module.css';

export default function SiteRoot({ children }) {
    return <div className={styles.theme}>{children}</div>;
}
