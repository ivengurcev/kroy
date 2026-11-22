import { useContext } from 'react';
import SeparatorContext from '../runtime/separatorContext.js';
import styles from './hr.module.css';
import Image from './Image.jsx';

export default function HR({ className = '' }) {
    const image = useContext(SeparatorContext);
    const hasImage = Boolean(image?.src);
    const monochrome = image?.mimeType === 'image/svg+xml';
    return <div role="separator" aria-orientation="horizontal" className={`${styles.hr} ${hasImage ? styles.withImage : ''} ${className}`}>
        {hasImage && <Image src={image.src} mimeType={image.mimeType} monochrome
            className={`${styles.image} ${monochrome ? styles.monochrome : ''}`} />}
    </div>;
}
