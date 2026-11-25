import Section from '../../runtime/Section.jsx';
import Image from '../../components/Image.jsx';
import HR from '../../components/HR.jsx';
import RichTextContent from '../../components/RichTextContent.jsx';
import styles from './heroEditorial.module.css';

/**
 * @kroy-title Первый экран — журнальный
 * @kroy-category Основное
 * @kroy-contract hero
 * @param {boolean} [props.showContacts=true] - Отображать контакты
 * @param {number} [props.minHeight=760] - Минимальная высота, px
 * @param {'left'|'center'|'right'} [props.photoPosition=center] - Положение фотографии
 * @kroy showContacts widget=switch
 * @kroy minHeight min=0
 * @kroy photoPosition optionLabels=left:Слева,center:Центр,right:Справа
 */
export default function HeroEditorial({ data, options = {} }) {
    const { eyebrow, title, subtitle, lead, features = [], photo, captionTitle, description, topNote, bottomNote, socials = [] } = data;
    const photoPosition = ['left', 'center', 'right'].includes(options.photoPosition) ? options.photoPosition : 'center';
    const hasCaption = captionTitle || description;
    const minHeight = typeof options.minHeight === 'number' && Number.isFinite(options.minHeight) && options.minHeight >= 0
        ? `${options.minHeight}px` : undefined;

    return (
        <Section className={styles.section} fullBleed style={{ '--hero-min-height': minHeight }}>
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
                            {(title || subtitle) && <HR className={styles.rule} />}
                        </header>
                    )}
                    {(lead || features.length > 0) && (
                        <div className={styles.story}>
                            <RichTextContent value={lead} className={styles.lead} />
                            {features.length > 0 && (
                                <ul className={styles.features}>
                                    {features.map(({ icon, text }, index) => (
                                        <li className={styles.feature} key={index}>
                                            {icon && <span className={styles.featureIcon}><Image src={icon} monochrome className={styles.featureImage} /></span>}
                                            <RichTextContent value={text} />
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
                                    <RichTextContent value={description} className={styles.description} />
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
            {options.showContacts !== false && socials.length > 0 && (
                <nav className={styles.socials} aria-label="Социальные сети">
                    {socials.map(({ name, link }, index) => (
                        <a key={`${name}-${link}-${index}`} href={link} target="_blank" rel="noopener noreferrer">{name}</a>
                    ))}
                </nav>
            )}
        </Section>
    );
}
