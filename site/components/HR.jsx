import { useContext } from 'react';
import SeparatorContext from '../runtime/separatorContext.js';
import styles from './hr.module.css';

export default function HR({ className = '' }) {
    const image = useContext(SeparatorContext);
    return <hr className={`${styles.hr} ${className}`} style={image ? { backgroundImage: `url(${JSON.stringify(image)})` } : undefined} />;
}
