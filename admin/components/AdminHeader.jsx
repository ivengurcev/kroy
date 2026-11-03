import { useEffect, useRef, useState } from 'react';
import styles from './AdminHeader.module.css';
import OysiteLogo from './OysiteLogo.svg';
import OysiteMark from './OysiteMark.svg';
import Button from '../ui/Button.jsx';
import Icon from '../ui/Icon.jsx';
import AdminPageHeader from './AdminPageHeader.jsx';

export default function AdminHeader({
    mode = 'editor',
    title = '',
    actions,
    page = {},
    isDirty = false,
    loadStatus = 'loading',
    saveStatus = 'idle',
    onSave,
    onToggleSidebar,
    onToggleMobileMenu,
    sidebarCollapsed = false,
    mobileMenuOpen = false,
    onAllowUnload,
}) {
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [logoutError, setLogoutError] = useState('');
    const [publication, setPublication] = useState({ status: 'idle' });
    const [publicationNoticeVisible, setPublicationNoticeVisible] = useState(false);
    const publishRequestRef = useRef(false);
    const publicationVersionRef = useRef(0);
    const siteMode = mode === 'site';
    const editorMode = mode === 'editor';
    const headerTitle = title || (editorMode ? page.title : '') || 'Администрирование';
    const isSaving = saveStatus === 'saving';
    const saveDisabled = loadStatus !== 'success' || !isDirty || isSaving;
    const saveLabel = loadStatus !== 'success'
        ? 'Сохранение недоступно'
        : isSaving
            ? 'Сохранение…'
            : !isDirty && saveStatus === 'success'
                ? 'Сохранено'
                : 'Сохранить';
    const saveTitle = isDirty && !isSaving
        ? 'Сохранить изменения страницы'
        : saveLabel;
    const isPublishing = publication.status === 'building' || publication.status === 'publishing';
    const hasPublicationResult = publication.status === 'success' || publication.status === 'error';
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
                if (!response.ok) throw new Error(result.error || 'Не удалось получить состояние публикации.');
                if (!cancelled && version === publicationVersionRef.current) setPublication(result);
            } catch (error) {
                if (!cancelled && version === publicationVersionRef.current) setPublication({
                    status: 'error',
                    message: error.message || 'Не удалось получить состояние публикации.',
                });
            }
        }

        loadPublicationStatus();
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        if (!isPublishing) return undefined;

        const timer = window.setInterval(async () => {
            const version = publicationVersionRef.current;

            try {
                const response = await fetch('/api/site/publish');
                const result = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(result.error || 'Не удалось получить состояние публикации.');
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

    useEffect(() => {
        if (isPublishing) {
            setPublicationNoticeVisible(true);
            return undefined;
        }

        if (!hasPublicationResult) {
            setPublicationNoticeVisible(false);
            return undefined;
        }

        setPublicationNoticeVisible(true);
        const timer = window.setTimeout(() => setPublicationNoticeVisible(false), 5000);
        return () => window.clearTimeout(timer);
    }, [hasPublicationResult, isPublishing, publication.status, publication.message, publication.releaseId]);

    function openPreview(event) {
        if (isDirty && !window.confirm('В предпросмотре будут показаны только сохранённые изменения. Продолжить?')) {
            event.preventDefault();
        }
    }

    async function publishSite() {
        if (publishRequestRef.current || isPublishing) return;
        if (
            isDirty
            && !window.confirm('В публикацию попадут только сохранённые изменения. Продолжить?')
        ) {
            return;
        }

        publishRequestRef.current = true;
        publicationVersionRef.current += 1;
        setPublication({ status: 'building', message: 'Запуск публикации…' });

        try {
            const response = await fetch('/api/site/publish', { method: 'POST' });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result.error || 'Не удалось запустить публикацию.');
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
                    <AdminPageHeader title={headerTitle} />
                </div>

                <div className={styles.rightGroup}>
                    {actions && <div className={styles.contextActions}>{actions}</div>}
                    <Button
                        className={`${styles.action} ${styles.saveAction} ${isSaving ? styles.savingAction : ''}`}
                        variant="primary"
                        aria-label={saveLabel}
                        title={siteMode ? (isDirty && !isSaving ? 'Сохранить настройки' : saveLabel) : saveTitle}
                        disabled={saveDisabled || !onSave}
                        onClick={onSave}
                    ><Icon name="save" /><span>Сохранить</span></Button>

                    <Button
                        className={`${styles.action} ${styles.publishAction}`}
                        variant="outline"
                        aria-label={publishLabel}
                        title={isPublishing ? publishLabel : 'Опубликовать сайт'}
                        disabled={isPublishing}
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

                {(editorMode || siteMode) && saveStatus === 'error' && (
                    <span className={styles.saveError} role="alert">Не удалось сохранить {siteMode ? 'оформление' : 'страницу'}.</span>
                )}
                {(isPublishing || publicationNoticeVisible) && (
                    <span
                        className={`${styles.publishStatus} ${publication.status === 'error' ? styles.publishError : ''}`}
                        role={publication.status === 'error' ? 'alert' : 'status'}
                    >
                        {publication.status === 'success'
                            ? (publication.releaseId ? `Опубликован релиз ${publication.releaseId}.` : publication.message)
                            : publication.message}
                    </span>
                )}
                {logoutError && (
                    <span className={styles.saveError} role="alert">{logoutError}</span>
                )}
            </div>

        </>
    );
}
