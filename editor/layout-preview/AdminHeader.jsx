import styles from './AdminShell.module.css';
import KroyLogo from '../../design/kroy-logo.svg';
import Button from './ui/Button.jsx';
import Card from './ui/Card.jsx';

export default function AdminHeader({ mode = 'editor', page = {}, isDirty = false }) {
    const pagesMode = mode === 'pages';

    function openPageMap(event) {
        if (
            isDirty
            && !window.confirm('Есть несохранённые изменения. Перейти к карте страниц?')
        ) {
            event.preventDefault();
        }
    }

    return (
        <Card className={`${styles.primaryBar} ${pagesMode ? styles.pagesPrimaryBar : ''}`}>
            <div className={styles.logo} aria-label="Kroy">
                <KroyLogo className={styles.logoMark} aria-hidden="true" />
                <strong>Kroy</strong>
            </div>

            <Button className={styles.headerTile} disabled>
                <span className={styles.tileIcon}>⚙︎</span>
                <span><b>Настройки сайта</b><small>Дизайн, меню, контакты</small></span>
                <i>›</i>
            </Button>

            {pagesMode ? (
                <Button className={`${styles.headerTile} ${styles.activeHeaderTile}`} disabled>
                    <span className={styles.tileIcon}>≡</span>
                    <span><b>Карта страниц</b><small>Все страницы сайта</small></span>
                </Button>
            ) : (
                <a className={styles.headerTile} href="/admin/pages" onClick={openPageMap}>
                    <span className={styles.tileIcon}>≡</span>
                    <span><b>Карта страниц</b><small>Все страницы сайта</small></span>
                    <i>›</i>
                </a>
            )}

            {!pagesMode && (
                <section className={styles.currentPage}>
                    <span className={styles.tileIcon}>⌂</span>
                    <span className={styles.pageName}><small>Текущая страница</small><b>{page.title || '—'} <i>✎</i></b></span>
                    <span className={styles.pageAddress}>
                        <small>Адрес страницы</small>
                        <span><code>{page.path || '—'}</code><Button variant="compact" disabled>✎ <em>Изменить</em></Button></span>
                    </span>
                </section>
            )}

            {!pagesMode && (
                <>
                    <Button className={styles.previewAction} disabled>Посмотреть сайт ↗</Button>
                    <Button className={styles.publishAction} variant="success" disabled><b className={styles.actionIcon}>↥</b> <span>Опубликовать</span></Button>
                </>
            )}
        </Card>
    );
}
