import styles from './text.module.css';
import Section from '../../runtime/Section.jsx';

/**
 * @kroy-title Текст — обычный
 * @kroy-category Основное
 * @kroy-contract text
 */
export default function Text({ data }) {
    const { title, paragraphs } = data;

    return (
        <Section className={styles.aboutContainer}>
            <div className={styles.about}>
                {title && <h2 className={styles.title}>{title}</h2>}
                {paragraphs.length > 0 && (
                    <div className={styles.text}>
                        {paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
                    </div>
                )}
            </div>
        </Section>
    );
}
