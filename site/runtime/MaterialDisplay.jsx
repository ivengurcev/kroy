import { createMaterialDisplay } from './materialDisplay.mjs';
import styles from './MaterialDisplay.module.css';
import { useWidgetSpacing } from './widgetDisplay.js';

export default function ArticleDisplay({ record }) {
    const spacing = useWidgetSpacing();
    return createMaterialDisplay(record, styles, spacing);
}
