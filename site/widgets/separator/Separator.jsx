import HR from '../../components/HR.jsx';
import styles from './separator.module.css';
import { useWidgetSpacing } from '../../runtime/widgetDisplay.js';

/**
 * @kroy-title Разделитель
 * @kroy-category Основное
 * @kroy-contract separator
 */
export default function Separator() {
    const spacing = useWidgetSpacing();
    return <div className={styles.separator} style={spacing}><HR /></div>;
}
