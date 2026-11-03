import styles from './AdminPageShell.module.css';
import AdminPageHeader from './AdminPageHeader.jsx';
import { useAdminHeader } from './AdminWorkspaceContext.jsx';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const useMeasuredLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export default function AdminPageShell({
    title,
    actions,
    status = 'success',
    errorMessage,
    headerMode = 'pages',
    isDirty = false,
    saveStatus = 'idle',
    onSave,
    children,
}) {
    useAdminHeader({ mode: headerMode, title, isDirty, loadStatus: status, saveStatus, onSave });
    const headerRef = useRef(null);
    const [headerHeight, setHeaderHeight] = useState(null);

    useMeasuredLayoutEffect(() => {
        const header = headerRef.current;
        if (!header) return undefined;
        const updateHeaderHeight = () => setHeaderHeight(header.getBoundingClientRect().height);
        if (typeof ResizeObserver === 'undefined') {
            window.addEventListener('resize', updateHeaderHeight);
            updateHeaderHeight();
            return () => window.removeEventListener('resize', updateHeaderHeight);
        }
        const observer = new ResizeObserver(updateHeaderHeight);
        observer.observe(header);
        updateHeaderHeight();
        return () => observer.disconnect();
    }, []);

    return (
        <div className={styles.page} style={{ '--admin-page-header-height': headerHeight ? `${headerHeight}px` : undefined }}>
            <AdminPageHeader headerRef={headerRef} title={title} actions={actions} />
            {status === 'loading' && <p className={styles.status} role="status">Загрузка…</p>}
            {status === 'error' && <p className={styles.status} role="alert">{errorMessage}</p>}
            {status === 'success' && children}
        </div>
    );
}
