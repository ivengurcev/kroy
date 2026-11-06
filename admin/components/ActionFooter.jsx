import { Children, Fragment, cloneElement, isValidElement, useEffect, useLayoutEffect, useRef, useState } from 'react';
import styles from './ActionFooter.module.css';
import { formStateLabel } from '../editor/actionState.mjs';

function activeActions(children) {
    return Children.toArray(children).flatMap((child) => {
        if (!isValidElement(child) || child.props.disabled || child.props['aria-disabled'] === true || child.props['aria-disabled'] === 'true') return [];
        if (child.type !== Fragment) return [child];
        const actions = activeActions(child.props.children);
        return actions.length ? [cloneElement(child, {}, actions)] : [];
    });
}

// Screens supply action elements with their availability; the footer only presents them.
export default function ActionFooter({ children, isDirty = false, saveStatus = 'idle' }) {
    const ref = useRef(null);
    const [height, setHeight] = useState(51);
    const actions = activeActions(children);
    const hasActions = actions.length > 0;
    const measureEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;
    measureEffect(() => {
        if (!ref.current) return undefined;
        const rootStyle = document.documentElement.style;
        const previousScrollPadding = rootStyle.scrollPaddingBottom;
        const measure = () => {
            const nextHeight = ref.current.getBoundingClientRect().height;
            setHeight(nextHeight);
            rootStyle.scrollPaddingBottom = `${nextHeight + 16}px`;
        };
        measure();
        const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
        observer?.observe(ref.current);
        window.addEventListener('resize', measure);
        return () => {
            observer?.disconnect();
            window.removeEventListener('resize', measure);
            rootStyle.scrollPaddingBottom = previousScrollPadding;
        };
    }, [hasActions]);
    if (!hasActions) return null;
    return <div style={{ height }} className={styles.space}>
        <footer ref={ref} className={`${styles.footer} ${isDirty ? styles.dirty : ''} ${saveStatus === 'error' ? styles.error : ''}`} aria-label="Действия текущей формы">
            <span role="status" aria-live="polite" className={styles.state}>{formStateLabel(isDirty, saveStatus)}</span>
            <div className={styles.actions}>{actions}</div>
        </footer>
    </div>;
}
