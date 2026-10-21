import styles from './hero.module.css';

function TelegramIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M21.6 3.2c.6-.3 1.2.2 1 1l-3.3 15.5c-.2 1.1-.9 1.4-1.8.9l-5-3.7-2.4 2.3c-.3.3-.5.5-1 .5l.4-5.1 9.4-8.5c.4-.4-.1-.6-.6-.3L6.7 13.2l-4.9-1.5c-1.1-.3-1.1-1.1.2-1.6z" />
        </svg>
    );
}

function InstagramIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="5" />
            <circle cx="12" cy="12" r="4" />
            <circle cx="17.5" cy="6.7" r=".8" fill="currentColor" stroke="none" />
        </svg>
    );
}

function SocialLink({ href, icon, children }) {
    if (!href) return null;

    return (
        <a className={styles.social} href={href} target="_blank" rel="noopener noreferrer">
            <span className={styles.socialIcon} aria-hidden="true">{icon}</span>
            {children}
        </a>
    );
}

/**
 * @param {object} props
 * @param {string} props.eyebrow - Надпись над заголовком
 * @param {string} props.title - Главный заголовок
 * @param {string} props.doctorName - Имя врача
 * @param {string} props.description - Описание врача и стажа
 * @param {string} props.photo - Фотография
 * @param {string} props.telegramUrl - Telegram
 * @param {string} props.maxUrl - MAX
 * @param {string} props.instagramUrl - Instagram
 *
 * @kroy eyebrow widget=input
 * @kroy title widget=textarea
 * @kroy doctorName widget=input
 * @kroy description widget=textarea
 * @kroy photo widget=image
 * @kroy telegramUrl widget=url
 * @kroy maxUrl widget=url
 * @kroy instagramUrl widget=url
 */
export default function Hero({
    eyebrow = '',
    title = '',
    doctorName = '',
    description = '',
    photo = '',
    telegramUrl = '',
    maxUrl = '',
    instagramUrl = '',
}) {
    const hasCaption = doctorName || description;

    return (
        <section className={styles.heroContainer}>
            <div className={styles.hero}>
                <div
                    className={styles.photo}
                    style={{ backgroundImage: photo ? `url(${JSON.stringify(photo)})` : 'none' }}
                    aria-hidden="true"
                />
                <div className={styles.inner}>
                    <div className={styles.content}>
                        {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
                        {title && <h1 className={styles.title}>{title}</h1>}
                    </div>

                    {(telegramUrl || maxUrl || instagramUrl) && (
                        <nav className={styles.socials} aria-label="Социальные сети">
                            <SocialLink href={telegramUrl} icon={<TelegramIcon />}>Telegram</SocialLink>
                            <SocialLink href={maxUrl} icon={<span className={styles.maxMark}>MAX</span>}>MAX</SocialLink>
                            <SocialLink href={instagramUrl} icon={<InstagramIcon />}>Instagram</SocialLink>
                        </nav>
                    )}

                    {hasCaption && (
                        <div className={styles.caption}>
                            {doctorName && <p className={styles.doctorName}>{doctorName}</p>}
                            {description && <p className={styles.description}>{description}</p>}
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}
