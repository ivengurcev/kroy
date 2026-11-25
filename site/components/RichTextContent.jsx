import { renderLexicalContent } from '../runtime/lexicalContent.mjs';
import { hasRichText } from '../../shared/richText.mjs';
import styles from './richTextContent.module.css';

export default function RichTextContent({ value, className = '' }) {
    if (!hasRichText(value)) return null;
    return <div className={`${styles.content} ${className}`}>{renderLexicalContent(value)}</div>;
}
