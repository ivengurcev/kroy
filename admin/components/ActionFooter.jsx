import { Children, useEffect, useLayoutEffect, useRef, useState } from 'react';
import styles from './ActionFooter.module.css';
import { formStateLabel } from '../editor/actionState.mjs';

// Screens supply their own actions; the footer only presents form state.
export default function ActionFooter({ children, isDirty = false, saveStatus = 'idle' }) {
    const ref = useRef(null);
    const [height, setHeight] = useState(84);
    const hasActions = Children.toArray(children).length > 0;
    const measureEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;
    measureEffect(() => {
        if (!ref.current) return undefined;
        const measure = () => setHeight(ref.current.getBoundingClientRect().height);
        measure();
        if (typeof ResizeObserver === 'undefined') return undefined;
        const observer = new ResizeObserver(measure);
        observer.observe(ref.current);
        return () => observer.disconnect();
    }, [hasActions]);
    if (!hasActions) return null;
    return <div style={{ height }} className={styles.space}>
        <footer ref={ref} className={`${styles.footer} ${isDirty ? styles.dirty : ''} ${saveStatus === 'error' ? styles.error : ''}`} aria-label="Действия текущей формы">
            <span role="status" aria-live="polite" className={styles.state}>{formStateLabel(isDirty, saveStatus)}</span>
            <div className={styles.actions}>{children}</div>
        </footer>
    </div>;
}
