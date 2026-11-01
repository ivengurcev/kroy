import { createArticleDisplay } from './articleDisplay.mjs';
import styles from './ArticleDisplay.module.css';

export default function ArticleDisplay({ record }) {
    return createArticleDisplay(record, styles);
}
