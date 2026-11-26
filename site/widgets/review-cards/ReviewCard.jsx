import styles from './reviewCards.module.css';

export default function ReviewCard({ review }) {
    return <article className={styles.card}>
        {review.mediaUrl && <img className={styles.photo} src={review.mediaUrl} alt="" />}
        <blockquote className={styles.quote}>{review.text}</blockquote>
        <footer className={styles.author}>
            <strong>{review.authorName}</strong>
            {review.authorSubtitle && <span>{review.authorSubtitle}</span>}
            <time dateTime={review.reviewDate}>{review.reviewDate?.split('-').reverse().join('.')}</time>
        </footer>
    </article>;
}
