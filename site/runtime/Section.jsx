import styles from './section.module.css';
import { useWidgetSpacing } from './widgetDisplay.js';

export default function Section({ children, className = '', fullBleed = false, style, ...props }) {
    const spacing = useWidgetSpacing();
    const classes = [styles.section, fullBleed ? styles.fullBleed : '', className].filter(Boolean).join(' ');
    return <section className={classes} {...props} style={{ ...style, ...spacing }}>{children}</section>;
}
