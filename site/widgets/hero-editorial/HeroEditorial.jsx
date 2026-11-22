import Section from '../../runtime/Section.jsx';
import Icon from '../../components/Icon.jsx';
import HR from '../../components/HR.jsx';
import styles from './heroEditorial.module.css';

/**
 * @kroy-title Первый экран — журнальный
 * @kroy-category Основное
 * @kroy-contract hero
 * @param {'left'|'center'|'right'} [props.photoPosition=center] - Положение фотографии
 * @kroy photoPosition optionLabels=left:Слева,center:Центр,right:Справа
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
                            {(title || subtitle) && <HR className={styles.rule} />}
                        </header>
                    )}
                    {(lead || features.length > 0) && (
                        <div className={styles.story}>
                            {lead && <p className={styles.lead}>{lead}</p>}
                            {features.length > 0 && (
                                <ul className={styles.features}>
                                    {features.map(({ icon, text }, index) => (
                                        <li className={styles.feature} key={index}>
                                            {icon !== 'none' && <span className={styles.featureIcon}><Icon name={icon} /></span>}
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
