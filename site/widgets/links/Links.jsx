import styles from './links.module.css';
import Section from '../../runtime/Section.jsx';
import Icon from '../../components/Icon.jsx';

/**
 * @kroy-title Ссылки
 * @kroy-category Контакты
 * @kroy-contract links
 */
export default function Links({ data }) {
    const { title, socials } = data;

    return (
        <Section className={styles.linksContainer}>
            <div className={styles.links}>
                {title && <h2 className={styles.title}>{title}</h2>}
                {socials.length > 0 && <nav aria-label={title || 'Ссылки'} className={styles.list}>
                    {socials.map((social, index) => <a href={social.link} key={`${social.name}-${social.link}-${index}`} target="_blank" rel="noopener noreferrer"><span>{social.name}</span><Icon name={social.type} /></a>)}
                </nav>}
            </div>
        </Section>
    );
}
