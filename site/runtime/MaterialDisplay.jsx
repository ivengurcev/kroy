import { createMaterialDisplay } from './materialDisplay.mjs';
import styles from './MaterialDisplay.module.css';

export default function ArticleDisplay({ record }) {
    return createMaterialDisplay(record, styles);
}
