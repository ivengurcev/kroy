import Section from '../../runtime/Section.jsx';
import styles from './comparisonRows.module.css';
import RichTextContent from '../../components/RichTextContent.jsx';

/**
 * @kroy-title Сравнение — строки
 * @kroy-category Контент
 * @kroy-contract comparison
 */
export default function ComparisonRows({ data }) {
    const { title, subtitle, rows = [] } = data;
    if (!title && !rows.length) return null;

    return (
        <Section className={styles.section}>
            <div className={styles.inner}>
                {(title || subtitle) && (
                    <header className={styles.header}>
                        {title && <h2 className={styles.title}>{title}</h2>}
                        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
                    </header>
                )}
                {rows.length > 0 && (
                    <ul className={styles.rows}>
                        {rows.map((row, index) => (
                            <li key={index} className={styles.row} data-tone={row.tone}>
                                {row.title && (
                                    <div className={styles.category}>
                                        <h3 className={styles.rowTitle}>{row.title}</h3>
                                    </div>
                                )}
                                {(row.description || row.note) && (
                                    <div className={styles.details}>
                                        <RichTextContent value={row.description} className={styles.paragraphs} />
                                        <RichTextContent value={row.note} className={styles.note} />
                                    </div>
                                )}
                                <RichTextContent value={row.examples} className={styles.examples} />
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </Section>
    );
}
