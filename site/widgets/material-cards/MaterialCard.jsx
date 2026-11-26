import styles from './materialCards.module.css';

export default function MaterialCard({ material }) {
    const { title, summary, coverUrl, href } = material;
    const Link = href ? 'a' : 'div';
    return <article className={styles.card}>
        <Link className={styles.link} href={href ?? undefined}>
            {coverUrl && <img className={styles.cover} src={coverUrl} alt="" />}
            <div className={styles.body}>
                <h2 className={styles.title}>{title}</h2>
                {summary && <p className={styles.summary}>{summary}</p>}
                {href && <span className={styles.read}>Читать</span>}
            </div>
        </Link>
    </article>;
}
