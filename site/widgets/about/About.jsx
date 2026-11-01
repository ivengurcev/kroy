import styles from './about.module.css';
import Section from '../../runtime/Section.jsx';

/**
 * @kroy-title О себе
 * @kroy-category Основное
 * @kroy-contract about
 */
export default function About({ data }) {
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
