import styles from './text.module.css';
import Section from '../../runtime/Section.jsx';
import RichTextContent from '../../components/RichTextContent.jsx';

/**
 * @kroy-title Текст — обычный
 * @kroy-category Основное
 * @kroy-contract text
 */
export default function Text({ data }) {
    const { title, text } = data;
    if (!title && !text) return null;

    return (
        <Section className={styles.aboutContainer}>
            <div className={styles.about}>
                {title && <h2 className={styles.title}>{title}</h2>}
                <RichTextContent value={text} className={styles.text} />
            </div>
        </Section>
    );
}
