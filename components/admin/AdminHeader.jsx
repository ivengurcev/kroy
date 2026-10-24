import { useRef, useState } from 'react';
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
    page = {},
    isDirty = false,
    loadStatus = 'loading',
    saveStatus = 'idle',
    onSave,
    onPageDetailsChange,
}) {
    const [detailsOpen, setDetailsOpen] = useState(false);
    const detailsButtonRef = useRef(null);
    const pagesMode = mode === 'pages';
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

    function openPageMap(event) {
        if (
            isDirty
            && !window.confirm('Есть несохранённые изменения. Перейти к карте страниц?')
        ) {
            event.preventDefault();
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

    return (
        <>
            <Card className={`${barStyles.bar} ${barStyles.floating} ${styles.headerBar} ${pagesMode ? styles.pagesHeader : ''}`}>
                <div className={styles.leftGroup}>
                    <div className={styles.logo} role="img" aria-label="Oysite">
                        <OysiteLogo className={styles.fullLogo} aria-hidden="true" />
                        <OysiteMark className={styles.compactLogo} aria-hidden="true" />
                    </div>

                    <Button className={styles.action} aria-label="Сайт" title="Управление сайтом" disabled>
                        <Icon name="globe" />
                        <span className={styles.actionLabel}>Сайт</span>
                    </Button>

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

                {!pagesMode && (
                    <div className={styles.centerGroup}>
                        <span className={styles.pageTitle} title={page.title || 'Текущая страница'}>
                            {page.title || '—'}
                        </span>
                        <Button
                            className={styles.iconAction}
                            variant="compact"
                            ref={detailsButtonRef}
                            aria-label="Настройки страницы"
                            title="Настройки страницы"
                            disabled={detailsDisabled}
                            onClick={() => setDetailsOpen(true)}
                        >
                            <Icon name="settings" />
                        </Button>
                    </div>
                )}

                <div className={styles.rightGroup}>
                    {!pagesMode && (
                        <Button
                            className={`${styles.action} ${styles.saveAction} ${isSaving ? styles.savingAction : ''}`}
                            variant="primary"
                            aria-label={saveLabel}
                            title={saveTitle}
                            disabled={saveDisabled}
                            onClick={onSave}
                        >
                            <Icon name="save" />
                            <span className={styles.actionLabel}>{saveLabel}</span>
                        </Button>
                    )}

                    <Button className={`${styles.action} ${styles.publishAction}`} variant="outline" aria-label="Опубликовать" title="Опубликовать сайт" disabled>
                        <Icon name="publish" />
                        <span className={styles.actionLabel}>Опубликовать</span>
                    </Button>
                    <Button className={styles.action} aria-label="Посмотреть сайт" title="Открыть предпросмотр сайта" disabled>
                        <Icon name="preview" />
                        <span className={styles.actionLabel}>Предпросмотр</span>
                    </Button>
                </div>

                {!pagesMode && saveStatus === 'error' && (
                    <span className={styles.saveError} role="alert">Не удалось сохранить страницу.</span>
                )}
            </Card>

            {!pagesMode && detailsOpen && (
                <PageDetailsDialog
                    page={page}
                    onSaved={savePageDetails}
                    onCancel={closePageDetails}
                />
            )}
        </>
    );
}
