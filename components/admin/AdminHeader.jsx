import { useEffect, useRef, useState } from 'react';
import styles from './AdminHeader.module.css';
import OysiteLogo from './OysiteLogo.svg';
import OysiteMark from './OysiteMark.svg';
import Button from '../ui/Button.jsx';
import Card from '../ui/Card.jsx';
import Icon from '../ui/Icon.jsx';
import barStyles from '../ui/AdminBar.module.css';
import PageDetailsDialog from './PageDetailsDialog.jsx';

export default function AdminHeader({
    mode = 'editor',
    title = '',
    page = {},
    isDirty = false,
    loadStatus = 'loading',
    saveStatus = 'idle',
    onSave,
    onPageDetailsChange,
}) {
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [logoutError, setLogoutError] = useState('');
    const [publication, setPublication] = useState({ status: 'idle' });
    const detailsButtonRef = useRef(null);
    const publishRequestRef = useRef(false);
    const publicationVersionRef = useRef(0);
    const pagesMode = mode === 'pages';
    const trashMode = mode === 'trash';
    const siteMode = mode === 'site';
    const editorMode = mode === 'editor';
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
    const detailsDisabled = loadStatus !== 'success' || !page.id;
    const isPublishing = publication.status === 'building' || publication.status === 'publishing';
    const publishLabel = publication.status === 'building'
        ? 'Сборка…'
        : publication.status === 'publishing'
            ? 'Публикация…'
            : 'Опубликовать';

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

    function openPageMap(event) {
        if (
            isDirty
            && !window.confirm('Есть несохранённые изменения. Перейти к карте страниц?')
        ) {
            event.preventDefault();
        }
    }

    function openSiteSettings(event) {
        if (isDirty && !window.confirm('Есть несохранённые изменения. Перейти к настройкам сайта?')) {
            event.preventDefault();
        }
    }

    function openHome(event) {
        if (isDirty && !window.confirm('Есть несохранённые изменения. Перейти на главную страницу?')) {
            event.preventDefault();
        }
    }

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

    function closePageDetails() {
        setDetailsOpen(false);
        requestAnimationFrame(() => detailsButtonRef.current?.focus());
    }

    function savePageDetails(updatedPage) {
        onPageDetailsChange(updatedPage);
        closePageDetails();
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
            window.location.assign('/auth/signin');
        } catch (error) {
            setLogoutError(error.message || 'Не удалось выйти из аккаунта.');
            setIsLoggingOut(false);
        }
    }

    return (
        <>
            <Card className={`${barStyles.bar} ${barStyles.floating} ${styles.headerBar} ${pagesMode ? styles.pagesHeader : ''}`}>
                <div className={styles.leftGroup}>
                    <div className={styles.logo} role="img" aria-label="Oysite">
                        <OysiteLogo className={styles.fullLogo} aria-hidden="true" />
                        <OysiteMark className={styles.compactLogo} aria-hidden="true" />
                    </div>

                    {editorMode && page.path === '/' ? (
                        <span className={`${styles.action} ${styles.activeAction}`} aria-label="Главная страница" aria-current="page">
                            <Icon name="home" />
                            <span className={styles.actionLabel}>Главная</span>
                        </span>
                    ) : (
                        <a className={styles.action} href="/admin" aria-label="Главная страница" title="Открыть главную страницу" onClick={openHome}>
                            <Icon name="home" />
                            <span className={styles.actionLabel}>Главная</span>
                        </a>
                    )}

                    {siteMode ? (
                        <span className={`${styles.action} ${styles.activeAction}`} aria-label="Сайт" aria-current="page">
                            <Icon name="globe" />
                            <span className={styles.actionLabel}>Сайт</span>
                        </span>
                    ) : (
                        <a className={styles.action} href="/admin/site" aria-label="Сайт" title="Управление оформлением сайта" onClick={openSiteSettings}>
                            <Icon name="globe" />
                            <span className={styles.actionLabel}>Сайт</span>
                        </a>
                    )}

                    {pagesMode ? (
                        <span className={`${styles.action} ${styles.activeAction}`} aria-label="Карта страниц" aria-current="page">
                            <Icon name="pages" />
                            <span className={styles.actionLabel}>Карта страниц</span>
                        </span>
                    ) : (
                        <a className={styles.action} href="/admin/pages" aria-label="Карта страниц" title="Открыть карту страниц" onClick={openPageMap}>
                            <Icon name="pages" />
                            <span className={styles.actionLabel}>Карта страниц</span>
                        </a>
                    )}
                </div>

                {(editorMode || siteMode || pagesMode || trashMode) && (
                    <div className={styles.centerGroup}>
                        <span className={styles.pageTitle} title={siteMode || pagesMode || trashMode ? title : (page.title || 'Текущая страница')}>
                            {siteMode || pagesMode || trashMode ? title : (page.title || '—')}
                        </span>
                        {editorMode && <Button
                            className={styles.iconAction}
                            variant="compact"
                            ref={detailsButtonRef}
                            aria-label="Настройки страницы"
                            title="Настройки страницы"
                            disabled={detailsDisabled}
                            onClick={() => setDetailsOpen(true)}
                        >
                            <Icon name="settings" />
                        </Button>}
                    </div>
                )}

                <div className={styles.rightGroup}>
                    {(editorMode || siteMode) && (
                        <Button
                            className={`${styles.action} ${styles.saveAction} ${isSaving ? styles.savingAction : ''}`}
                            variant="primary"
                            aria-label={saveLabel}
                            title={siteMode ? (isDirty && !isSaving ? 'Сохранить настройки оформления' : saveLabel) : saveTitle}
                            disabled={saveDisabled}
                            onClick={onSave}
                        >
                            <Icon name="save" />
                            <span className={styles.actionLabel}>{saveLabel}</span>
                        </Button>
                    )}

                    <Button
                        className={`${styles.action} ${styles.publishAction}`}
                        variant="outline"
                        aria-label={publishLabel}
                        title={isPublishing ? publishLabel : 'Опубликовать сайт'}
                        disabled={isPublishing}
                        onClick={publishSite}
                    >
                        <Icon name="publish" />
                        <span className={styles.actionLabel}>{publishLabel}</span>
                    </Button>
                    <a
                        className={styles.action}
                        href={`/admin/preview?path=${encodeURIComponent(editorMode && page.path ? page.path : '/')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Посмотреть сайт"
                        title="Открыть предпросмотр сайта"
                        onClick={openPreview}
                    >
                        <Icon name="preview" />
                        <span className={styles.actionLabel}>Предпросмотр</span>
                    </a>
                    <Button
                        className={styles.action}
                        aria-label="Выйти"
                        title="Выйти из аккаунта"
                        disabled={isLoggingOut}
                        onClick={logOut}
                    >
                        <Icon name="logout" />
                        <span className={styles.actionLabel}>{isLoggingOut ? 'Выход…' : 'Выйти'}</span>
                    </Button>
                </div>

                {(editorMode || siteMode) && saveStatus === 'error' && (
                    <span className={styles.saveError} role="alert">Не удалось сохранить {siteMode ? 'оформление' : 'страницу'}.</span>
                )}
                {publication.status === 'success' && (
                    <span className={styles.publishStatus} role="status">
                        {publication.releaseId ? `Опубликован релиз ${publication.releaseId}.` : publication.message}
                    </span>
                )}
                {publication.status === 'error' && (
                    <span className={`${styles.publishStatus} ${styles.publishError}`} role="alert">
                        {publication.message}
                    </span>
                )}
                {logoutError && (
                    <span className={styles.saveError} role="alert">{logoutError}</span>
                )}
            </Card>

            {editorMode && detailsOpen && (
                <PageDetailsDialog
                    page={page}
                    onSaved={savePageDetails}
                    onCancel={closePageDetails}
                />
            )}
        </>
    );
}
