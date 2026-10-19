import styles from './Icon.module.css';

const icons = {
    add: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
    edit: <><path d="m4 20 4.2-1 10.6-10.6a2.1 2.1 0 0 0-3-3L5.2 16Z" /><path d="m14.5 6.5 3 3" /></>,
    delete: <><path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="m7 7 1 13h8l1-13" /><path d="M10 11v5M14 11v5" /></>,
    restore: <><path d="M4 10a8 8 0 1 1 2.3 7.7" /><path d="M4 4v6h6" /></>,
    save: <><path d="M5 4h12l2 2v14H5Z" /><path d="M8 4v6h8V4M8 20v-6h8v6" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" /></>,
    pages: <><path d="M5 5h14v14H5Z" /><path d="M8 9h8M8 12h8M8 15h5" /></>,
    trash: <><path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="m7 7 1 13h8l1-13" /></>,
    publish: <><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M5 14v6h14v-6" /></>,
    preview: <><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" /></>,
    up: <><path d="m6 10 6-6 6 6" /><path d="M12 4v16" /></>,
    down: <><path d="M12 4v16" /><path d="m6 14 6 6 6-6" /></>,
    back: <><path d="m9 6-6 6 6 6" /><path d="M3 12h11a6 6 0 0 1 6 6" /></>,
    forward: <><path d="m15 6 6 6-6 6" /><path d="M21 12H10a6 6 0 0 0-6 6" /></>,
    seo: <><circle cx="10" cy="10" r="6" /><path d="m14.5 14.5 5 5" /><path d="M7 10h6M10 7v6" /></>,
    home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10M9 20v-6h6v6" /></>,
    more: <><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" /></>,
    chevronRight: <path d="m9 5 7 7-7 7" />,
    desktop: <><rect x="3" y="4" width="18" height="13" rx="1.5" /><path d="M8 21h8M12 17v4" /></>,
    tablet: <><rect x="6" y="2" width="12" height="20" rx="2" /><path d="M11 18h2" /></>,
    phone: <><rect x="8" y="2" width="8" height="20" rx="2" /><path d="M11 18h2" /></>,
};

export default function Icon({ name, size = 20, className = '', ...props }) {
    return (
        <svg
            className={`${styles.icon} ${className}`}
            width={size}
            height={size}
            viewBox="0 0 24 24"
            aria-hidden="true"
            focusable="false"
            {...props}
        >
            {icons[name]}
        </svg>
    );
}
