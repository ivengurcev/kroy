import { useEffect, useMemo, useState } from 'react';
import { parts } from '../dist/kroy/parts.mjs';
import { widgets } from '../dist/kroy/widgets.mjs';
import SiteApp, { normalizePathname } from '../layout/SiteApp.jsx';
import adminTheme from '../styles/AdminTheme.module.css';
import '../layout/site.css';
import styles from './PreviewPage.module.css';

function normalizePreviewPath(value) {
    if (typeof value !== 'string' || !value.startsWith('/') || value.includes('?') || value.includes('#')) {
        return '/__kroy-preview-not-found__';
    }
    return normalizePathname(value);
}

function getInitialPath() {
    if (typeof window === 'undefined') return '/';
    return normalizePreviewPath(new URL(window.location.href).searchParams.get('path') ?? '/');
}

function pathFromPreviewUrl(url) {
    return url.pathname === '/admin/preview'
        ? normalizePreviewPath(url.searchParams.get('path') ?? '/')
        : normalizePreviewPath(url.pathname);
}

function previewUrlForPath(path) {
    return `/admin/preview?path=${encodeURIComponent(path)}`;
}

export default function PreviewPage() {
    const [snapshot, setSnapshot] = useState(null);
    const [status, setStatus] = useState('loading');
    const path = useMemo(getInitialPath, []);

    useEffect(() => {
        const controller = new AbortController();
        fetch('/api/site/preview', { signal: controller.signal })
            .then(async (response) => {
                if (!response.ok) throw new Error('Не удалось загрузить предпросмотр.');
                return response.json();
            })
            .then((data) => {
                setSnapshot(data);
                setStatus('success');
                document.title = data.pages[path]?.title ?? 'Страница не найдена';
            })
            .catch((error) => {
                if (error.name !== 'AbortError') setStatus('error');
            });
        return () => controller.abort();
    }, [path]);

    return <div className={styles.preview}>
        <div className={`${adminTheme.theme} ${styles.badge}`} role="status">
            Предпросмотр · сохранённая версия
        </div>
        {status === 'loading' && <p className={styles.message}>Загрузка предпросмотра…</p>}
        {status === 'error' && <p className={styles.message} role="alert">Не удалось загрузить предпросмотр.</p>}
        {status === 'success' && <SiteApp
            pages={snapshot.pages}
            path={path}
            parts={parts}
            widgets={widgets}
            theme={snapshot.theme}
            contacts={snapshot.contacts}
            catalog={snapshot.catalog}
            reviews={snapshot.reviews}
            pathFromUrl={pathFromPreviewUrl}
            urlForPath={previewUrlForPath}
            notFound={<main className={styles.notFound}><h1>404</h1><p>Страница не найдена.</p></main>}
        />}
    </div>;
}
