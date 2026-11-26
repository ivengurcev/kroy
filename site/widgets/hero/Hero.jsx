import styles from './hero.module.css';
import Section from '../../runtime/Section.jsx';
import Icon from '../../components/Icon.jsx';
import RichTextContent from '../../components/RichTextContent.jsx';
import { heroHeightMode, heroHeightStyle } from '../../runtime/heroHeight.js';

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
 * @param {'compact'|'normal'|'spacious'} [props.heightMode=normal] - Высота первого экрана
 * @kroy showContacts widget=switch
 * @kroy heightMode optionLabels=compact:Компактный,normal:Обычный,spacious:Просторный
 */
export default function Hero({ data, options = {} }) {
    const { eyebrow, title, captionTitle, description, photo, socials = [] } = data;
    const hasCaption = captionTitle || description;
    return (
        <Section className={styles.heroContainer} fullBleed style={heroHeightStyle(options)} data-height-mode={heroHeightMode(options)}>
            <div className={`${styles.hero} ${photo ? '' : styles.withoutPhoto}`}>
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
