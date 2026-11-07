import { useEffect, useRef, useState } from 'react';
import styles from './AdminHeader.module.css';
import OysiteLogo from './OysiteLogo.svg';
import OysiteMark from './OysiteMark.svg';
import Button from '../ui/Button.jsx';
import Icon from '../ui/Icon.jsx';
import AdminPageHeader from './AdminPageHeader.jsx';
import { publicationStateLabel, publicationBlocked } from '../editor/actionState.mjs';

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
}) {
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [logoutError, setLogoutError] = useState('');
    const [publication, setPublication] = useState({ status: 'idle' });
    const publishRequestRef = useRef(false);
    const publicationVersionRef = useRef(0);
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
            const version = publicationVersionRef.current;

            try {
                const response = await fetch('/api/site/publish');
                const result = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error('Не удалось получить состояние публикации.');
                if (!cancelled && version === publicationVersionRef.current) setPublication(result);
            } catch (error) {
                if (!cancelled && version === publicationVersionRef.current) setPublication({
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

        const timer = window.setInterval(async () => {
            const version = publicationVersionRef.current;

            try {
                const response = await fetch('/api/site/publish');
                const result = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error('Не удалось получить состояние публикации.');
                if (version === publicationVersionRef.current) setPublication(result);
            } catch (error) {
                if (version === publicationVersionRef.current) setPublication({
                    status: 'error',
                    message: error.message || 'Не удалось получить состояние публикации.',
                });
            }
        }, 1000);

        return () => window.clearInterval(timer);
    }, [isPublishing]);

    function openPreview(event) {
        if (isDirty && !window.confirm('В предпросмотре будут показаны только сохранённые изменения. Продолжить?')) {
            event.preventDefault();
        }
    }

    async function publishSite() {
        if (publishRequestRef.current || isPublishing) return;
        if (blocked) return;

        publishRequestRef.current = true;
        publicationVersionRef.current += 1;
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
                    {!list && <AdminPageHeader title={headerTitle} />}
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
                {publication.status === 'error' && <span className={`${styles.publishStatus} ${styles.publishError}`} role="alert">Не удалось опубликовать сайт или проверить публикацию. Повторите попытку.</span>}
                {logoutError && (
                    <span className={styles.saveError} role="alert">{logoutError}</span>
                )}
            </div>

        </>
    );
}
