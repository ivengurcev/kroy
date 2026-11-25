import styles from './hero.module.css';
import Section from '../../runtime/Section.jsx';
import Icon from '../../components/Icon.jsx';
import RichTextContent from '../../components/RichTextContent.jsx';

function SocialLink({ name, link, type }) {
    return (
        <a className={styles.social} href={link} target="_blank" rel="noopener noreferrer">
            <span className={styles.socialIcon} aria-hidden="true"><Icon name={type} /></span>
            {name}
        </a>
    );
}

/**
 * @kroy-title Первый экран
 * @kroy-category Основное
 * @kroy-contract hero
 * @param {boolean} [props.showContacts=true] - Отображать контакты
 * @param {number} [props.minHeight=750] - Минимальная высота, px
 * @kroy showContacts widget=switch
 * @kroy minHeight min=0
 */
export default function Hero({ data, options = {} }) {
    const { eyebrow, title, captionTitle, description, photo, socials = [] } = data;
    const hasCaption = captionTitle || description;
    const minHeight = typeof options.minHeight === 'number' && Number.isFinite(options.minHeight) && options.minHeight >= 0
        ? `${options.minHeight}px` : undefined;

    return (
        <Section className={styles.heroContainer} fullBleed style={{ '--hero-min-height': minHeight }}>
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

                    {options.showContacts !== false && socials.length > 0 && (
                        <nav className={styles.socials} aria-label="Социальные сети">
                            {socials.map(({ type, name, link }, index) => (
                                <SocialLink key={`${name}-${link}-${index}`} type={type} name={name} link={link} />
                            ))}
                        </nav>
                    )}

                    {hasCaption && (
                        <div className={styles.caption}>
                            {captionTitle && <p className={styles.captionTitle}>{captionTitle}</p>}
                            <RichTextContent value={description} className={styles.description} />
                        </div>
                    )}
                </div>
            </div>
        </Section>
    );
}
