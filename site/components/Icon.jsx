import styles from './icon.module.css';

const icons = {
    check: <path d="m5 12 4 4L19 6" />,
    star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z" />,
    heart: <path d="M20.8 5.6a5.5 5.5 0 0 0-7.8 0L12 6.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 22l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />,
    leaf: <><path d="M20 3C9 2 3 6 4 13c1 7 12 8 15-2 1-3 1-5 1-8Z" /><path d="M3 22 15 9" /></>,
    book: <><path d="M12 5v16M3 3c4 0 6 0 9 2 3-2 5-2 9-2v16c-4 0-6 0-9 2-3-2-5-2-9-2Z" /></>,
    shield: <><path d="m12 2 8 3v6c0 5-4 9-8 11-4-2-8-6-8-11V5Z" /><path d="m8 11 3 3 5-6" /></>,
    telegram: <path fill="currentColor" stroke="none" d="M21.6 3.2c.6-.3 1.2.2 1 1l-3.3 15.5c-.2 1.1-.9 1.4-1.8.9l-5-3.7-2.4 2.3c-.3.3-.5.5-1 .5l.4-5.1 9.4-8.5c.4-.4-.1-.6-.6-.3L6.7 13.2l-4.9-1.5c-1.1-.3-1.1-1.1.2-1.6z" />,
    instagram: <><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.7" r=".8" fill="currentColor" stroke="none" /></>,
    vk: <path fill="currentColor" stroke="none" d="M4 7h3.2c.2 3.6 1.7 5.1 2.9 5.4V7h3v3.1c1.2-.1 2.4-1.5 2.8-3.1H19c-.2 1.8-1.5 3.2-2.5 3.9 1 .5 2.5 1.6 3 4.1h-3.3c-.5-1.5-1.6-2.6-3.1-2.7V17h-.4C7.9 17 4.2 12.9 4 7z" />,
    youtube: <><path d="M21 8.1a2.5 2.5 0 0 0-1.8-1.8C17.6 6 12 6 12 6s-5.6 0-7.2.3A2.5 2.5 0 0 0 3 8.1 26 26 0 0 0 2.7 12c0 1.3.1 2.6.3 3.9A2.5 2.5 0 0 0 4.8 17c1.6.3 7.2.3 7.2.3s5.6 0 7.2-.3a2.5 2.5 0 0 0 1.8-1.8c.2-1.3.3-2.6.3-3.9s-.1-2.6-.3-3.9z" /><path d="m10 9 5 3-5 3z" /></>,
    tiktok: <path d="M15 5v9.2a3.8 3.8 0 1 1-3-3.7M15 5c.8 1.8 2.2 2.9 4 3.1" />,
    other: <path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1M14 11a5 5 0 0 0-7.1-.1l-2 2a5 5 0 0 0 7.1 7.1l1.1-1.1" />,
    // Monochrome MAX sign derived from its official brandbook.
    max: <g transform="scale(.24)" stroke="none"><path fill="currentColor" fillRule="evenodd" d="M50.7571 0.261719C78.2929 0.261719 99.8857 22.5974 99.8857 50.1474C99.8857 77.6974 77.6071 99.4903 51.0214 99.4903C41.5857 99.4903 37.0143 98.1617 29.65 92.9474C29.1429 92.5903 28.45 92.6831 28.0214 93.1403C22.3571 99.1831 7.85 103.426 7.18571 95.176C7.18571 80.7903 0 71.4474 0 49.876C0 21.5546 23.2214 0.261719 50.7571 0.261719ZM51.5286 24.8117C38.4643 24.126 28.2643 33.1974 26.0143 47.3831C24.15 59.1332 27.45 73.4546 30.2786 74.176C31.4786 74.4832 34.3571 72.276 36.4571 70.2974C36.85 69.926 37.45 69.8617 37.9071 70.1474C41.1786 72.1474 44.8786 73.6474 48.9571 73.8617C62.3714 74.5617 74.2571 64.0617 74.9643 50.6474C75.6643 37.2331 64.9429 25.5046 51.5286 24.8046V24.8117Z" /></g>,
    'chevron-left': <path d="m14.5 5-7 7 7 7" />,
    'chevron-right': <path d="m9.5 5 7 7-7 7" />,
    plus: <path d="M12 5v14M5 12h14" />,
    minus: <path d="M5 12h14" />,
};

export default function Icon({ name, size = 24, className = '' }) {
    const key = name === 'link' ? 'other' : name;
    if (!Object.hasOwn(icons, key)) return null;
    const shape = icons[key];
    return (
        <svg className={`${styles.icon} ${className}`} width={size} height={size} viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
            aria-hidden="true" focusable="false">
            {shape}
        </svg>
    );
}
