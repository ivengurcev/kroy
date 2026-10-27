import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import styles from './AdminLayout.module.css';
import theme from '../../styles/AdminTheme.module.css';

export default function AdminLayout({ header, children }) {
    const headerRef = useRef(null);
    const [headerHeight, setHeaderHeight] = useState(0);
    const useMeasuredLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

    useMeasuredLayoutEffect(() => {
        const headerElement = headerRef.current;
        if (!headerElement) return undefined;

        const updateHeaderHeight = () => {
            setHeaderHeight(headerElement.getBoundingClientRect().height);
        };

        updateHeaderHeight();
        if (typeof ResizeObserver === 'undefined') return undefined;

        const observer = new ResizeObserver(updateHeaderHeight);
        observer.observe(headerElement);
        return () => observer.disconnect();
    }, []);

    return (
        <div className={`${theme.theme} ${styles.layout}`} style={{ '--admin-header-offset': `${headerHeight}px` }}>
            <header ref={headerRef} className={styles.header}>{header}</header>
            <main className={styles.content}>{children}</main>
        </div>
    );
}
