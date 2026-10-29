import { useEffect, useRef, useState } from 'react';
import styles from './reviews.module.css';

/**
 * @kroy-title Отзывы
 * @kroy-category Контент
 *
 * @param {object} props
 * @param {string} props.title - Заголовок секции
 * @param {'auto'|'manual'} props.mode - Режим подбора
 * @param {number} props.limit - Максимальное количество отзывов
 * @param {string[]} props.reviewIds - Выбранные отзывы
 *
 * @kroy title widget=input
 * @kroy mode widget=select
 * @kroy limit widget=number
 * @kroy reviewIds widget=review-list
 */
export default function Reviews({ title = 'Отзывы', reviews = [] }) {
    const [index, setIndex] = useState(0);
    const [paused, setPaused] = useState(false);
    const [hovered, setHovered] = useState(false);
    const [focused, setFocused] = useState(false);
    const [hidden, setHidden] = useState(false);
    const touch = useRef(null);
    const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const canPlay = reviews.length > 1 && !paused && !hovered && !focused && !hidden && !reduced;
    const progressRunning = !paused && !hovered && !focused && !hidden;
    const goTo = (next) => setIndex((current) => (next + reviews.length) % reviews.length);

    useEffect(() => { setIndex((current) => Math.min(current, Math.max(0, reviews.length - 1))); }, [reviews.length]);
    useEffect(() => {
        const onVisibility = () => setHidden(document.hidden);
        onVisibility(); document.addEventListener('visibilitychange', onVisibility);
        return () => document.removeEventListener('visibilitychange', onVisibility);
    }, []);
    useEffect(() => {
        if (!canPlay) return undefined;
        const timer = window.setInterval(() => goTo(index + 1), 6000);
        return () => window.clearInterval(timer);
    }, [canPlay, index]);

    if (!reviews.length) return null;
    return <section className={styles.section}><div className={styles.inner} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocusCapture={() => setFocused(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }} onTouchStart={(event) => { touch.current = event.touches[0]?.clientX; }} onTouchEnd={(event) => { const start = touch.current; const end = event.changedTouches[0]?.clientX; if (start !== null && end !== undefined && Math.abs(start - end) > 40) goTo(start > end ? index + 1 : index - 1); touch.current = null; }}>
        {title && <h2 className={styles.title}>{title}</h2>}
        <div className={styles.viewport}><div className={styles.track} style={{ transform: `translateX(-${index * 100}%)` }}>{reviews.map((review) => <article className={`${styles.slide} ${review.mediaUrl ? '' : styles.withoutPhoto}`} key={review.id}><div className={styles.copy}><blockquote className={styles.quote}>{review.text}</blockquote><footer className={styles.author}><strong className={styles.authorName}>{review.authorName}</strong>{review.authorSubtitle && <span className={styles.authorSubtitle}>{review.authorSubtitle}</span>}<time className={styles.date} dateTime={review.reviewDate}>{review.reviewDate?.split('-').reverse().join('.')}</time></footer></div>{review.mediaUrl && <img className={styles.photo} src={review.mediaUrl} alt="" />}</article>)}</div></div>
        {reviews.length > 1 && <div className={styles.controls}><div className={styles.status}><span className={styles.counter}>{String(index + 1).padStart(2, '0')} <span className={styles.counterDivider}>/</span> {String(reviews.length).padStart(2, '0')}</span><span className={`${styles.progress} ${progressRunning ? styles.progressRunning : ''}`} aria-hidden="true"><span className={styles.progressFill} key={index} /></span><button className={styles.pauseButton} type="button" onClick={() => setPaused((value) => !value)} aria-label={paused ? 'Возобновить автопрокрутку' : 'Остановить автопрокрутку'} aria-pressed={paused}>{paused ? 'Продолжить' : 'Пауза'}</button></div><div className={styles.arrows}><button className={styles.arrowButton} type="button" onClick={() => goTo(index - 1)} aria-label="Предыдущий отзыв">←</button><button className={styles.arrowButton} type="button" onClick={() => goTo(index + 1)} aria-label="Следующий отзыв">→</button></div></div>}
        <div className={styles.links}><a className={styles.allReviewsLink} href="/reviews">Все отзывы</a><a className={styles.reviewButton} href="/reviews#form">Оставить отзыв</a></div>
    </div></section>;
}
