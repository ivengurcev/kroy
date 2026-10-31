import styles from './hero.module.css';
import Section from '../../layout/Section.jsx';
import MaxIcon from '../../components/site/MaxIcon.jsx';

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

function LinkIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1" />
            <path d="M14 11a5 5 0 0 0-7.1-.1l-2 2a5 5 0 0 0 7.1 7.1l1.1-1.1" />
        </svg>
    );
}

function socialIcon(type) {
    switch (type) {
        case 'telegram':
            return <TelegramIcon />;
        case 'max':
            return <MaxIcon />;
        case 'instagram':
            return <InstagramIcon />;
        default:
            return <LinkIcon />;
    }
}

function SocialLink({ name, link, type }) {
    return (
        <a className={styles.social} href={link} target="_blank" rel="noopener noreferrer">
            <span className={styles.socialIcon} aria-hidden="true">{socialIcon(type)}</span>
            {name}
        </a>
    );
}

/**
 * @kroy-title Первый экран
 * @kroy-category Основное
 * @kroy-contract hero
 */
export default function Hero({ data }) {
    const { eyebrow, title, captionTitle, description, photo, socials } = data;
    const hasCaption = captionTitle || description;

    return (
        <Section className={styles.heroContainer} fullBleed>
            <div className={styles.hero}>
                <div
                    className={`${styles.photo} ${photo ? '' : styles.photoEmpty}`}
                    style={{ backgroundImage: photo ? `url(${JSON.stringify(photo)})` : 'none' }}
                    aria-hidden="true"
                />
                <div className={styles.inner}>
                    <div className={styles.content}>
                        {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
                        {title && <h1 className={styles.title}>{title}</h1>}
                    </div>

                    {socials.length > 0 && (
                        <nav className={styles.socials} aria-label="Социальные сети">
                            {socials.map(({ type, name, link }, index) => (
                                <SocialLink key={`${name}-${link}-${index}`} type={type} name={name} link={link} />
                            ))}
                        </nav>
                    )}

                    {hasCaption && (
                        <div className={styles.caption}>
                            {captionTitle && <p className={styles.captionTitle}>{captionTitle}</p>}
                            {description && <p className={styles.description}>{description}</p>}
                        </div>
                    )}
                </div>
            </div>
        </Section>
    );
}
