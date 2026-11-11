import { useEffect, useRef } from 'react';
import Section from '../../runtime/Section.jsx';
import styles from './materialMasonry.module.css';

/**
 * @kroy-title Мозаика материалов
 * @kroy-category Материалы
 * @kroy-contract materials-list
 * @param {object} props
 * @param {number} [props.limit=6] - Количество материалов
 * @kroy limit widget=number min=1
 */
export default function MaterialMasonry({ data = [], options = {} }) {
    const gridRef = useRef(null);
    const numericLimit = Number(options.limit ?? 6);
    const limit = Number.isFinite(numericLimit) ? Math.max(0, Math.floor(numericLimit)) : 6;
    const items = data.slice(0, limit);

    useEffect(() => {
        const grid = gridRef.current;
        if (!grid || typeof ResizeObserver === 'undefined') return undefined;
        const contents = [...grid.querySelectorAll('[data-masonry-content]')];
        let frame = 0;
        const update = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                for (const content of contents) {
                    const span = `span ${Math.max(1, Math.ceil(content.getBoundingClientRect().height / 4))}`;
                    if (content.parentElement.style.gridRowEnd !== span) content.parentElement.style.gridRowEnd = span;
                }
            });
        };
        grid.dataset.masonryReady = 'true';
        const observer = new ResizeObserver(update);
        observer.observe(grid);
        contents.forEach((content) => observer.observe(content));
        update();
        return () => {
            observer.disconnect();
            cancelAnimationFrame(frame);
            delete grid.dataset.masonryReady;
            contents.forEach((content) => { content.parentElement.style.gridRowEnd = ''; });
        };
    }, [data, limit]);

    return <Section className={styles.section}>
        <div className={styles.inner}>
            {items.length ? <div className={styles.grid} ref={gridRef}>
                {items.map(({ slug, title, summary, coverUrl, href }) => {
                    const Link = href ? 'a' : 'div';
                    return <article className={styles.item} key={slug}>
                        <div className={styles.spacing} data-masonry-content>
                            <Link className={styles.card} href={href || undefined}>
                                {coverUrl && <img className={styles.cover} src={coverUrl} alt="" />}
                                <div className={styles.body}>
                                    <h2 className={styles.title}>{title}</h2>
                                    {summary && <p className={styles.summary}>{summary}</p>}
                                </div>
                            </Link>
                        </div>
                    </article>;
                })}
            </div> : <p className={styles.empty} role="status">Опубликованных материалов пока нет.</p>}
        </div>
    </Section>;
}
