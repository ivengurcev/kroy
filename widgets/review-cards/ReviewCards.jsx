import { useState } from 'react';
import Section from '../../layout/Section.jsx';
import ReviewForm from '../../parts/reviews/ReviewForm.jsx';
import styles from './reviewCards.module.css';

/**
 * @kroy-title Карточки отзывов
 * @kroy-category Отзывы
 * @kroy-contract reviews
 *
 * @param {object} props
 * @param {number} [props.columns=3] - Количество колонок
 *
 * @kroy columns widget=number min=1 max=4
 */
export default function ReviewCards({ data = {}, options = {} }) {
    const [formOpen, setFormOpen] = useState(false);
    const numericColumns = Number(options.columns);
    const columnCount = Number.isFinite(numericColumns)
        ? Math.min(4, Math.max(1, Math.round(numericColumns)))
        : 3;
    const { title = 'Отзывы', reviews = [], showSubmitButton = false } = data;

    if (!reviews.length && !showSubmitButton) return null;

    return (
        <Section className={styles.section}>
            <div className={styles.inner}>
                {title && <h2 className={styles.title}>{title}</h2>}
                {reviews.length > 0 && (
                    <div className={styles.grid} data-columns={columnCount} style={{ '--review-card-columns': columnCount }}>
                        {reviews.map((review) => (
                            <article className={styles.card} key={review.id}>
                                {review.mediaUrl && <img className={styles.photo} src={review.mediaUrl} alt="" />}
                                <blockquote className={styles.quote}>{review.text}</blockquote>
                                <footer className={styles.author}>
                                    <strong>{review.authorName}</strong>
                                    {review.authorSubtitle && <span>{review.authorSubtitle}</span>}
                                    <time dateTime={review.reviewDate}>{review.reviewDate?.split('-').reverse().join('.')}</time>
                                </footer>
                            </article>
                        ))}
                    </div>
                )}
                {showSubmitButton && (
                    <div className={styles.actions}>
                        <button className={styles.reviewButton} type="button" onClick={() => setFormOpen(true)}>
                            Оставить отзыв
                        </button>
                    </div>
                )}
            </div>
            <ReviewForm open={formOpen} onClose={() => setFormOpen(false)} />
        </Section>
    );
}
