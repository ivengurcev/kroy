import { useState } from 'react';
import Section from '../../runtime/Section.jsx';
import ReviewForm from '../../components/ReviewForm.jsx';
import CardCarousel from '../../components/CardCarousel.jsx';
import ReviewCard from '../review-cards/ReviewCard.jsx';
import styles from '../review-cards/reviewCards.module.css';

/**
 * @kroy-title Карусель отзывов
 * @kroy-category Отзывы
 * @kroy-contract reviews
 */
export default function ReviewCarousel({ data = {} }) {
    const [formOpen, setFormOpen] = useState(false);
    const { title = 'Отзывы', reviews = [], showSubmitButton = false } = data;

    if (!reviews.length && !showSubmitButton) return null;

    const occurrences = new Map();
    const items = reviews.map((review) => {
        const occurrence = occurrences.get(review.id) ?? 0;
        occurrences.set(review.id, occurrence + 1);
        const key = occurrence ? `${review.id}-${occurrence}` : review.id;
        return <ReviewCard key={key} review={review} />;
    });

    return (
        <Section className={styles.section}>
            <div className={styles.inner}>
                {title && <h2 className={styles.title}>{title}</h2>}
                {reviews.length > 0 && <CardCarousel label={title || 'Отзывы'}>{items}</CardCarousel>}
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
