import { useEffect, useRef, useState } from 'react';
import styles from './AdminHeader.module.css';
import OysiteLogo from './OysiteLogo.svg';
import OysiteMark from './OysiteMark.svg';
import Button from '../ui/Button.jsx';
import Icon from '../ui/Icon.jsx';
import AdminPageHeader from './AdminPageHeader.jsx';
import { createPublicationRequestTracker, publicationStateLabel, publicationBlocked } from '../editor/actionState.mjs';

export default function AdminHeader({
    mode = 'editor',
    title = '',
    list = false,
    page = {},
    isDirty = false,
    saveStatus = 'idle',
    onToggleSidebar,
    onToggleMobileMenu,
    sidebarCollapsed = false,
    mobileMenuOpen = false,
    onAllowUnload,
    notice,
}) {
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [logoutError, setLogoutError] = useState('');
    const [publication, setPublication] = useState({ status: 'idle' });
    const [publicationNotice, setPublicationNotice] = useState('');
    const [publicationError, setPublicationError] = useState('');
    const [dismissedNotice, setDismissedNotice] = useState(null);
    const previousPublicationStatus = useRef('idle');
    const publishRequestRef = useRef(false);
    const publicationRequests = useRef(null);
    if (!publicationRequests.current) publicationRequests.current = createPublicationRequestTracker();
    const editorMode = mode === 'editor';
    const headerTitle = title || (editorMode ? page.title : '') || 'Администрирование';
    const blocked = publicationBlocked(isDirty, saveStatus);
    const isPublishing = publication.status === 'building' || publication.status === 'publishing';
    const publishLabel = publication.status === 'building'
        ? 'Сборка…'
        : publication.status === 'publishing'
            ? 'Публикация…'
            : 'Опубликовать';
    const logoutLabel = isLoggingOut ? 'Выход…' : 'Выйти';

    useEffect(() => {
        let cancelled = false;

        async function loadPublicationStatus() {
            if (publishRequestRef.current) return;
            const version = publicationRequests.current.next();

            try {
                const response = await fetch('/api/site/publish', { cache: 'no-store' });
                const result = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error('Не удалось получить состояние публикации.');
                if (!cancelled && publicationRequests.current.isCurrent(version)) setPublication(result);
            } catch (error) {
                if (!cancelled && publicationRequests.current.isCurrent(version)) setPublication({
                    status: 'error',
                    message: error.message || 'Не удалось получить состояние публикации.',
                });
            }
        }

        loadPublicationStatus();
        window.addEventListener('kroy:saved', loadPublicationStatus);
        window.addEventListener('focus', loadPublicationStatus);
        const timer = window.setInterval(loadPublicationStatus, 15000);
        return () => {
            cancelled = true;
            window.clearInterval(timer);
            window.removeEventListener('kroy:saved', loadPublicationStatus);
            window.removeEventListener('focus', loadPublicationStatus);
        };
    }, []);

    useEffect(() => {
        if (!isPublishing) return undefined;
        let cancelled = false;
        let timer;
        async function poll() {
            if (publishRequestRef.current) {
                if (!cancelled) timer = window.setTimeout(poll, 1000);
                return;
            }
            const version = publicationRequests.current.next();

            try {
                const response = await fetch('/api/site/publish', { cache: 'no-store' });
                const result = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error('Не удалось получить состояние публикации.');
                if (!cancelled && publicationRequests.current.isCurrent(version)) setPublication(result);
            } catch (error) {
                if (!cancelled && publicationRequests.current.isCurrent(version)) setPublication({
                    status: 'error',
                    message: error.message || 'Не удалось получить состояние публикации.',
                });
            } finally {
                if (!cancelled) timer = window.setTimeout(poll, 1000);
            }
        }
        timer = window.setTimeout(poll, 1000);

        return () => { cancelled = true; window.clearTimeout(timer); };
    }, [isPublishing]);

    useEffect(() => {
        const previous = previousPublicationStatus.current;
        previousPublicationStatus.current = publication.status;
        if (publication.status === 'error') setPublicationError(publication.message || 'Не удалось опубликовать сайт или проверить публикацию. Повторите попытку.');
        if ((previous === 'building' || previous === 'publishing') && publication.status === 'success') {
            setPublicationNotice(publication.releaseId ? `Опубликован релиз ${publication.releaseId}` : 'Сайт опубликован');
        } else if (publication.status === 'building' || publication.status === 'publishing' || publication.status === 'error') {
            setPublicationNotice('');
        }
    }, [publication.status, publication.releaseId, publication.message]);

    useEffect(() => {
        if (!publicationNotice) return undefined;
        const timer = window.setTimeout(() => setPublicationNotice(''), 6000);
        return () => window.clearTimeout(timer);
    }, [publicationNotice]);

    function openPreview(event) {
        if (isDirty && !window.confirm('В предпросмотре будут показаны только сохранённые изменения. Продолжить?')) {
            event.preventDefault();
        }
    }

    async function publishSite() {
        if (publishRequestRef.current || isPublishing) return;
        if (blocked) return;

        publishRequestRef.current = true;
        setPublicationError('');
        publicationRequests.current.next();
        setPublication({ status: 'building', message: 'Запуск публикации…' });

        try {
            const response = await fetch('/api/site/publish', { method: 'POST' });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error('Не удалось запустить публикацию. Повторите попытку.');
            setPublication(result);
        } catch (error) {
            setPublication({
                status: 'error',
                message: error.message || 'Не удалось запустить публикацию.',
            });
        } finally {
            publishRequestRef.current = false;
        }
    }

    async function logOut() {
        if (
            isDirty
            && !window.confirm('Есть несохранённые изменения. Выйти из аккаунта?')
        ) {
            return;
        }

        setLogoutError('');
        setIsLoggingOut(true);
        try {
            const csrfResponse = await fetch('/auth/csrf', { credentials: 'same-origin' });
            if (!csrfResponse.ok) throw new Error('Не удалось получить CSRF-токен.');
            const { csrfToken } = await csrfResponse.json();
            if (!csrfToken) throw new Error('CSRF-токен отсутствует.');

            const body = new URLSearchParams({ csrfToken });
            const response = await fetch('/auth/signout', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body,
            });
            if (!response.ok) throw new Error('Не удалось завершить сессию.');
            onAllowUnload?.();
            window.location.assign('/auth/signin');
        } catch (error) {
            setLogoutError(error.message || 'Не удалось выйти из аккаунта.');
            setIsLoggingOut(false);
        }
    }

    const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 820px)').matches;

    return (
        <>
            <div className={styles.headerBar}>
                <div className={styles.leftGroup}>
                    <a className={styles.logo} href="/" aria-label="Oysite — на главную сайта" title="Открыть публичный сайт">
                        <OysiteLogo className={styles.fullLogo} aria-hidden="true" />
                        <OysiteMark className={styles.compactLogo} aria-hidden="true" />
                    </a>
                    <Button
                        className={styles.menuToggle}
                        aria-label={isMobile ? mobileMenuOpen ? 'Закрыть меню' : 'Открыть меню' : sidebarCollapsed ? 'Развернуть меню' : 'Свернуть меню'}
                        title={isMobile ? mobileMenuOpen ? 'Закрыть меню' : 'Открыть меню' : sidebarCollapsed ? 'Развернуть меню' : 'Свернуть меню'}
                        aria-expanded={isMobile ? mobileMenuOpen : !sidebarCollapsed}
                        aria-controls="admin-sidebar"
                        onClick={() => {
                            if (window.matchMedia('(max-width: 820px)').matches) onToggleMobileMenu?.();
                            else onToggleSidebar?.();
                        }}
                    ><Icon name="menu" size={23} /></Button>
                    <div className={`${styles.pageTitle} ${list ? styles.listTitle : ''}`}><AdminPageHeader title={headerTitle} /></div>
                </div>

                <div className={styles.rightGroup}>
                    <span className={styles.publicationState} role="status" aria-live="polite">{publicationStateLabel(publication)}</span>
                    <Button
                        className={`${styles.action} ${styles.publishAction}`}
                        variant="outline"
                        aria-label={publishLabel}
                        title={blocked ? 'Сначала сохраните изменения' : isPublishing ? publishLabel : 'Опубликовать сайт'}
                        disabled={isPublishing || blocked}
                        aria-describedby={blocked ? 'publication-blocked' : undefined}
                        onClick={publishSite}
                    ><Icon name="publish" /><span>{publishLabel}</span></Button>
                    <a
                        className={`${styles.iconAction} ${styles.action}`}
                        href={`/admin/preview?path=${encodeURIComponent(editorMode && page.path ? page.path : '/')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Предпросмотр сайта"
                        title="Предпросмотр сайта"
                        aria-disabled={isLoggingOut}
                        onClick={(event) => {
                            if (isLoggingOut) event.preventDefault();
                            else openPreview(event);
                        }}
                    >
                        <Icon name="preview" />
                    </a>
                    <Button
                        className={`${styles.iconAction} ${styles.action}`}
                        aria-label={logoutLabel}
                        title={isLoggingOut ? 'Выход из аккаунта…' : 'Выйти из аккаунта'}
                        disabled={isLoggingOut}
                        onClick={logOut}
                    >
                        <Icon name="logout" />
                    </Button>
                </div>

                {blocked && <span id="publication-blocked" className={styles.visuallyHidden}>Сначала сохраните изменения</span>}
                <section className={styles.notifications} aria-label="Уведомления">
                    {[
                        notice && dismissedNotice !== (notice.id ?? notice) ? {
                            ...notice, key: 'workspace', dismiss: () => setDismissedNotice(notice.id ?? notice),
                        } : null,
                        publicationError ? { key: 'publication-error', variant: 'error', message: publicationError, dismiss: () => setPublicationError('') } : null,
                        logoutError ? { key: 'logout-error', variant: 'error', message: logoutError, dismiss: () => setLogoutError('') } : null,
                        publicationNotice ? { key: 'publication-success', variant: 'success', message: publicationNotice, dismiss: () => setPublicationNotice('') } : null,
                    ].filter(Boolean).map((item) => (
                        <div key={item.key} className={styles.notification} data-variant={item.variant ?? 'info'}>
                            <div className={styles.notificationContent}>
                                <span role={item.variant === 'error' ? 'alert' : 'status'}>{item.message}</span>
                                {item.action && <Button disabled={item.action.disabled} onClick={item.action.onClick}>{item.action.label}</Button>}
                            </div>
                            <Button variant="listIcon" className={styles.dismissNotice} aria-label="Закрыть уведомление" onClick={item.dismiss}>
                                <Icon name="close" size={18} />
                            </Button>
                        </div>
                    ))}
                </section>
            </div>

        </>
    );
}
