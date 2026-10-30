import styles from './section.module.css';

export default function Section({ children, className = '', fullBleed = false, ...props }) {
    const classes = [styles.section, fullBleed ? styles.fullBleed : '', className].filter(Boolean).join(' ');
    return <section className={classes} {...props}>{children}</section>;
}
