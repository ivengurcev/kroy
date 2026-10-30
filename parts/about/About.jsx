import styles from './about.module.css';
import Section from '../../layout/Section.jsx';

/**
 * @kroy-title О себе
 * @kroy-category Основное
 *
 * @param {object} props
 * @param {string} props.title - Заголовок секции
 * @param {string} props.text - Текст
 *
 * @kroy title widget=textarea
 * @kroy text widget=textarea
 */
export default function About({ title = '', text = '' }) {
    const paragraphs = typeof text === 'string'
        ? text.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean)
        : [];

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
