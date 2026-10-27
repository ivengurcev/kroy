import styles from './links.module.css';

function LinkIcon() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1M14 11a5 5 0 0 0-7.1-.1l-2 2a5 5 0 0 0 7.1 7.1l1.1-1.1" />
        </svg>
    );
}

/**
 * @kroy-title Ссылки
 * @kroy-category Контакты
 *
 * @param {object} props
 * @param {string} props.title - Заголовок секции
 * @param {{name: string, link: string}[]} props.socials - Социальные сети
 *
 * @kroy title widget=input
 * @kroy socials.name label=Название maxLength=80
 * @kroy socials.link label=Ссылка widget=url
 */
export default function Links({ title = '', socials = [] }) {
    const visibleLinks = Array.isArray(socials)
        ? socials.filter(({ name, link }) => name?.trim() && link?.trim())
        : [];

    return (
        <section className={styles.linksContainer}>
            <div className={styles.links}>
                {title && <h2 className={styles.title}>{title}</h2>}
                {visibleLinks.length > 0 && <nav aria-label={title || 'Ссылки'} className={styles.list}>
                    {visibleLinks.map(({ name, link }, index) => <a href={link.trim()} key={`${name}-${link}-${index}`} target="_blank" rel="noopener noreferrer"><span>{name.trim()}</span><LinkIcon /></a>)}
                </nav>}
            </div>
        </section>
    );
}
