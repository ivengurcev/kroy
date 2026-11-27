import Section from '../../runtime/Section.jsx';
import RichTextContent from '../../components/RichTextContent.jsx';
import styles from './document.module.css';

/**
 * @kroy-title Правовой документ
 * @kroy-contract document
 */
export default function Document({ data }) {
    return <Section><RichTextContent value={data.content} className={styles.document} /></Section>;
}
