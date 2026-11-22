import Section from '../../runtime/Section.jsx';
import styles from './heroEditorial.module.css';

function FeatureIcon({ name }) {
    const paths = {
        check: <path d="m5 12 4 4L19 6" />,
        star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z" />,
        heart: <path d="M20.8 5.6a5.5 5.5 0 0 0-7.8 0L12 6.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 22l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />,
        leaf: <><path d="M20 3C9 2 3 6 4 13c1 7 12 8 15-2 1-3 1-5 1-8Z" /><path d="M3 22 15 9" /></>,
        book: <><path d="M12 5v16M3 3c4 0 6 0 9 2 3-2 5-2 9-2v16c-4 0-6 0-9 2-3-2-5-2-9-2Z" /></>,
        shield: <><path d="m12 2 8 3v6c0 5-4 9-8 11-4-2-8-6-8-11V5Z" /><path d="m8 11 3 3 5-6" /></>,
    };
    if (!paths[name]) return null;
    return (
        <span className={styles.featureIcon} aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                {paths[name]}
            </svg>
        </span>
    );
}

/**
 * @kroy-title Первый экран — журнальный
 * @kroy-category Основное
 * @kroy-contract hero
 * @param {'left'|'center'|'right'} [props.photoPosition=center] - Положение фотографии
 */
export default function HeroEditorial({ data, options = {} }) {
    const { eyebrow, title, subtitle, lead, features = [], photo, captionTitle, description, topNote, bottomNote, socials = [] } = data;
    const photoPosition = ['left', 'center', 'right'].includes(options.photoPosition) ? options.photoPosition : 'center';
    const hasCaption = captionTitle || description;

    return (
        <Section className={styles.section} fullBleed>
            <div className={`${styles.scene} ${photo ? styles.withPhoto : ''}`}>
                {photo && (
                    <div className={styles.photo} aria-hidden="true" style={{
                        backgroundImage: `url(${JSON.stringify(photo)})`,
                        backgroundPosition: `${photoPosition} center`,
                    }} />
                )}
                <div className={styles.inner}>
                    {(eyebrow || title || subtitle) && (
                        <header className={styles.heading}>
                            {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
                            {(title || subtitle) && (
                                <h1 className={styles.title}>
                                    {title && <span>{title}</span>}
                                    {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
                                </h1>
                            )}
                            {(title || subtitle) && <div className={styles.rule} aria-hidden="true"><span>◆</span></div>}
                        </header>
                    )}
                    {(lead || features.length > 0) && (
                        <div className={styles.story}>
                            {lead && <p className={styles.lead}>{lead}</p>}
                            {features.length > 0 && (
                                <ul className={styles.features}>
                                    {features.map(({ icon, text }, index) => (
                                        <li className={styles.feature} key={index}>
                                            <FeatureIcon name={icon} />
                                            <span>{text}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}
                    {(hasCaption) && (
                        <div className={styles.footer}>
                            {hasCaption && (
                                <div className={styles.caption}>
                                    {captionTitle && <p className={styles.captionTitle}>{captionTitle}</p>}
                                    {description && <p className={styles.description}>{description}</p>}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </Section>
    );
}
