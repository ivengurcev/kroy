import { useEffect, useRef, useState } from 'react';
import ReviewForm from './ReviewForm.jsx';
import styles from './reviews.module.css';
import Section from '../../layout/Section.jsx';

const AUTOPLAY_DELAY = 6000;

/**
 * @kroy-title Отзывы
 * @kroy-category Контент
 * @kroy-contract reviews
 *
 * @param {object} props
 * @param {string} props.title - Заголовок секции
 * @param {'auto'|'manual'} props.mode - Режим подбора
 * @param {number} props.limit - Максимальное количество отзывов
 * @param {string[]} props.reviewIds - Выбранные отзывы
 * @param {boolean} props.showSubmitButton - Показывать кнопку "Оставить отзыв"
 * @param {boolean} props.showAllReviewsButton - Показывать кнопку "Все отзывы"
 *
 * @kroy title widget=input
 * @kroy mode widget=select
 * @kroy limit widget=number
 * @kroy reviewIds widget=review-list
 * @kroy showSubmitButton widget=checkbox
 * @kroy showAllReviewsButton widget=checkbox
 */
export default function Reviews({ title = 'Отзывы', reviews = [], showSubmitButton = false, showAllReviewsButton = false }) {
    const [index, setIndex] = useState(0);
    const [paused, setPaused] = useState(false);
    const [hidden, setHidden] = useState(false);
    const [formOpen, setFormOpen] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [canExpand, setCanExpand] = useState(false);
    const touch = useRef(null);
    const quoteRefs = useRef([]);
    const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const canPlay = reviews.length > 1 && !paused && !hidden && !reduced && !expanded;
    const progressPaused = paused || hidden || expanded;
    const goBy = (offset) => {
        setExpanded(false);
        setIndex((current) => (current + offset + reviews.length) % reviews.length);
    };

    useEffect(() => { setIndex((current) => Math.min(current, Math.max(0, reviews.length - 1))); }, [reviews.length]);
    useEffect(() => {
        const onVisibility = () => setHidden(document.hidden);
        onVisibility(); document.addEventListener('visibilitychange', onVisibility);
        return () => document.removeEventListener('visibilitychange', onVisibility);
    }, []);
    useEffect(() => {
        if (!canPlay) return undefined;
        const timer = window.setTimeout(() => {
            setExpanded(false);
            setIndex((current) => (current + 1) % reviews.length);
        }, AUTOPLAY_DELAY);
        return () => window.clearTimeout(timer);
    }, [canPlay, index, reviews.length]);

    useEffect(() => {
        const quote = quoteRefs.current[index];
        if (!quote) {
            setCanExpand(false);
            return undefined;
        }
        if (expanded) {
            setCanExpand(true);
            return undefined;
        }
        const update = () => setCanExpand(quote.scrollHeight > quote.clientHeight + 1);
        update();
        const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
        observer?.observe(quote);
        return () => observer?.disconnect();
    }, [expanded, index, reviews]);

    if (!reviews.length) return null;
    return <Section className={styles.section}><div className={styles.inner} onTouchStart={(event) => { touch.current = event.touches[0]?.clientX; }} onTouchEnd={(event) => { const start = touch.current; const end = event.changedTouches[0]?.clientX; if (start !== null && end !== undefined && Math.abs(start - end) > 40) goBy(start > end ? 1 : -1); touch.current = null; }}>
        {title && <h2 className={styles.title}>{title}</h2>}
        <div className={`${styles.slider} ${reviews.length > 1 ? styles.withNavigation : ''}`}>{reviews.length > 1 && <button className={`${styles.arrowButton} ${styles.previousButton}`} type="button" onClick={() => goBy(-1)} aria-label="Предыдущий отзыв"><svg className={styles.arrowIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m14.5 5-7 7 7 7" /></svg></button>}<div className={styles.viewport}><div className={styles.track} style={{ transform: `translateX(-${index * 100}%)` }}>{reviews.map((review, reviewIndex) => { const isCurrent = reviewIndex === index; const isExpanded = isCurrent && expanded; return <article className={`${styles.slide} ${review.mediaUrl ? '' : styles.withoutPhoto}`} key={review.id}><div className={styles.copy}><blockquote ref={(element) => { quoteRefs.current[reviewIndex] = element; }} className={`${styles.quote} ${isExpanded ? styles.quoteExpanded : ''}`}>{review.text}</blockquote>{isCurrent && canExpand && <button className={styles.expandButton} type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={isExpanded}>{isExpanded ? 'Свернуть' : 'Показать полностью'}</button>}<footer className={styles.author}><strong className={styles.authorName}>{review.authorName}</strong>{review.authorSubtitle && <span className={styles.authorSubtitle}>{review.authorSubtitle}</span>}<time className={styles.date} dateTime={review.reviewDate}>{review.reviewDate?.split('-').reverse().join('.')}</time></footer></div>{review.mediaUrl && <img className={styles.photo} src={review.mediaUrl} alt="" />}</article>; })}</div></div>{reviews.length > 1 && <button className={`${styles.arrowButton} ${styles.nextButton}`} type="button" onClick={() => goBy(1)} aria-label="Следующий отзыв"><svg className={styles.arrowIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9.5 5 7 7-7 7" /></svg></button>}</div>
        {(reviews.length > 1 || showSubmitButton) && <div className={styles.controls}>{reviews.length > 1 && <div className={styles.status}>{reviews.length > 1 && <button className={`${styles.arrowButton} ${styles.mobileArrowButton}`} type="button" onClick={() => goBy(-1)} aria-label="Предыдущий отзыв"><svg className={styles.arrowIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m14.5 5-7 7 7 7" /></svg></button>}<span className={styles.counter}>{String(index + 1).padStart(2, '0')} <span className={styles.counterDivider}>/</span> {String(reviews.length).padStart(2, '0')}</span><span className={`${styles.progress} ${!reduced ? styles.progressRunning : ''} ${progressPaused ? styles.progressPaused : ''}`} style={{ '--review-autoplay-duration': `${AUTOPLAY_DELAY}ms` }} aria-hidden="true"><span className={styles.progressFill} key={index} /></span><button className={styles.pauseButton} type="button" onClick={() => setPaused((value) => !value)} aria-label={paused ? 'Возобновить автопрокрутку' : 'Остановить автопрокрутку'} aria-pressed={paused}>{paused ? 'Продолжить' : 'Пауза'}</button>{reviews.length > 1 && <button className={`${styles.arrowButton} ${styles.mobileArrowButton}`} type="button" onClick={() => goBy(1)} aria-label="Следующий отзыв"><svg className={styles.arrowIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9.5 5 7 7-7 7" /></svg></button>}</div>}{showSubmitButton && <div className={styles.links}><button className={styles.reviewButton} type="button" onClick={() => setFormOpen(true)}>Оставить отзыв</button></div>}</div>}
        <ReviewForm open={formOpen} onClose={() => setFormOpen(false)} />
    </div></Section>;
}
