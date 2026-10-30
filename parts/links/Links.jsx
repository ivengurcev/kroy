import styles from './links.module.css';
import Section from '../../layout/Section.jsx';
import { socialType } from '../../socialLinks.mjs';

function LinkIcon({ type }) {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            {type === 'telegram' && <path fill="currentColor" stroke="none" d="M21.6 3.2c.6-.3 1.2.2 1 1l-3.3 15.5c-.2 1.1-.9 1.4-1.8.9l-5-3.7-2.4 2.3c-.3.3-.5.5-1 .5l.4-5.1 9.4-8.5c.4-.4-.1-.6-.6-.3L6.7 13.2l-4.9-1.5c-1.1-.3-1.1-1.1.2-1.6z" />}
            {type === 'instagram' && <><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.7" r=".8" fill="currentColor" stroke="none" /></>}
            {type === 'max' && <text x="3" y="16" fill="currentColor" stroke="none" fontSize="8" fontWeight="700">MAX</text>}
            {type === 'vk' && <path fill="currentColor" stroke="none" d="M4 7h3.2c.2 3.6 1.7 5.1 2.9 5.4V7h3v3.1c1.2-.1 2.4-1.5 2.8-3.1H19c-.2 1.8-1.5 3.2-2.5 3.9 1 .5 2.5 1.6 3 4.1h-3.3c-.5-1.5-1.6-2.6-3.1-2.7V17h-.4C7.9 17 4.2 12.9 4 7z" />}
            {type === 'youtube' && <><path d="M21 8.1a2.5 2.5 0 0 0-1.8-1.8C17.6 6 12 6 12 6s-5.6 0-7.2.3A2.5 2.5 0 0 0 3 8.1 26 26 0 0 0 2.7 12c0 1.3.1 2.6.3 3.9A2.5 2.5 0 0 0 4.8 17c1.6.3 7.2.3 7.2.3s5.6 0 7.2-.3a2.5 2.5 0 0 0 1.8-1.8c.2-1.3.3-2.6.3-3.9s-.1-2.6-.3-3.9z" /><path d="m10 9 5 3-5 3z" /></>}
            {type === 'tiktok' && <path d="M15 5v9.2a3.8 3.8 0 1 1-3-3.7M15 5c.8 1.8 2.2 2.9 4 3.1" />}
            {type === 'other' && <path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1M14 11a5 5 0 0 0-7.1-.1l-2 2a5 5 0 0 0 7.1 7.1l1.1-1.1" />}
        </svg>
    );
}

/**
 * @kroy-title Ссылки
 * @kroy-category Контакты
 *
 * @param {object} props
 * @param {string} props.title - Заголовок секции
 *
 * @kroy title widget=input
 */
export default function Links({ title = '', socials = [] }) {
    const visibleLinks = Array.isArray(socials)
        ? socials.filter(({ name, link }) => name?.trim() && link?.trim())
        : [];

    return (
        <Section className={styles.linksContainer}>
            <div className={styles.links}>
                {title && <h2 className={styles.title}>{title}</h2>}
                {visibleLinks.length > 0 && <nav aria-label={title || 'Ссылки'} className={styles.list}>
                    {visibleLinks.map((social, index) => <a href={social.link.trim()} key={`${social.name}-${social.link}-${index}`} target="_blank" rel="noopener noreferrer"><span>{social.name.trim()}</span><LinkIcon type={socialType(social)} /></a>)}
                </nav>}
            </div>
        </Section>
    );
}
