import Section from '../../layout/Section.jsx';
import styles from './articleCards.module.css';

/**
 * @kroy-title Карточки статей
 * @kroy-category Статьи
 * @kroy-contract articles-list
 */
export default function ArticleCards({ data }) {
    return (
        <Section className={styles.section}>
            <div className={styles.inner}>
                {data.length ? <div className={styles.grid}>
                    {data.map(({ slug, title, summary, coverUrl, href }) => {
                        const Link = href ? 'a' : 'div';
                        return <article className={styles.card} key={slug}>
                            <Link className={styles.link} href={href ?? undefined}>
                                {coverUrl && <img className={styles.cover} src={coverUrl} alt="" />}
                                <div className={styles.body}>
                                    <h2 className={styles.title}>{title}</h2>
                                    {summary && <p className={styles.summary}>{summary}</p>}
                                    {href && <span className={styles.read}>Читать</span>}
                                </div>
                            </Link>
                        </article>;
                    })}
                </div> : <p className={styles.empty} role="status">Опубликованных статей пока нет.</p>}
            </div>
        </Section>
    );
}
