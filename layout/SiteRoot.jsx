import styles from '../styles/SiteTheme.module.css';

export default function SiteRoot({ children, tokens }) {
    return <div className={styles.theme} style={tokens}>{children}</div>;
}
