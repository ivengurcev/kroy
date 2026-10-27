import { useEffect, useMemo, useState } from 'react';
import { parts } from '../dist/kroy/parts.mjs';
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

function useSystemPalette(mode) {
    const [systemPalette, setSystemPalette] = useState('light');

    useEffect(() => {
        if (mode !== 'system') return undefined;
        const media = window.matchMedia('(prefers-color-scheme: dark)');
        const update = () => setSystemPalette(media.matches ? 'dark' : 'light');
        update();
        media.addEventListener('change', update);
        return () => media.removeEventListener('change', update);
    }, [mode]);

    return mode === 'system' ? systemPalette : mode;
}

export default function PreviewPage() {
    const [snapshot, setSnapshot] = useState(null);
    const [status, setStatus] = useState('loading');
    const path = useMemo(getInitialPath, []);
    const palette = useSystemPalette(snapshot?.theme.mode);

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

    const tokens = snapshot && palette
        ? { ...snapshot.theme[palette], colorScheme: palette }
        : undefined;

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
            pathFromUrl={pathFromPreviewUrl}
            urlForPath={previewUrlForPath}
            notFound={<main className={styles.notFound}><h1>404</h1><p>Страница не найдена.</p></main>}
            tokens={tokens}
        />}
    </div>;
}
