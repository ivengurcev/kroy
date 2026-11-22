import styles from './image.module.css';

export default function Image({ src, mimeType, monochrome = false, alt = '', className = '' }) {
    if (!src) return null;
    if (!monochrome || mimeType !== 'image/svg+xml') {
        return <img src={src} alt={alt} className={className} />;
    }

    const mask = `url(${JSON.stringify(src)})`;
    return <span
        className={`${styles.mask} ${className}`}
        role={alt ? 'img' : undefined}
        aria-label={alt || undefined}
        aria-hidden={alt ? undefined : true}
        style={{ maskImage: mask, WebkitMaskImage: mask }}
    />;
}
