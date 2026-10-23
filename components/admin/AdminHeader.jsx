import styles from './AdminHeader.module.css';
import OysiteLogo from './OysiteLogo.svg';
import Button from '../ui/Button.jsx';
import Card from '../ui/Card.jsx';
import Icon from '../ui/Icon.jsx';

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
            <div className={styles.logo} role="img" aria-label="Oysite">
                <OysiteLogo className={styles.logoMark} aria-hidden="true" />
            </div>

            <Button className={styles.headerTile} disabled>
                <span className={styles.tileIcon}><Icon name="settings" size={22} /></span>
                <span><b>Настройки сайта</b><small>Дизайн, меню, контакты</small></span>
                <Icon className={styles.chevron} name="chevronRight" />
            </Button>

            {pagesMode ? (
                <Button className={`${styles.headerTile} ${styles.activeHeaderTile}`} disabled>
                    <span className={styles.tileIcon}><Icon name="pages" size={22} /></span>
                    <span><b>Карта страниц</b><small>Все страницы сайта</small></span>
                </Button>
            ) : (
                <a className={styles.headerTile} href="/admin/pages" onClick={openPageMap}>
                    <span className={styles.tileIcon}><Icon name="pages" size={22} /></span>
                    <span><b>Карта страниц</b><small>Все страницы сайта</small></span>
                    <Icon className={styles.chevron} name="chevronRight" />
                </a>
            )}

            {!pagesMode && (
                <section className={styles.currentPage}>
                    <span className={styles.tileIcon}><Icon name="home" size={22} /></span>
                    <span className={styles.pageName}><small>Текущая страница</small><b>{page.title || '—'} <span className={styles.editIcon}><Icon name="edit" size={15} /></span></b></span>
                    <span className={styles.pageAddress}>
                        <small>Адрес страницы</small>
                        <span><code>{page.path || '—'}</code><Button variant="compact" disabled><Icon name="edit" size={16} /> <em>Изменить</em></Button></span>
                    </span>
                </section>
            )}

            {!pagesMode && (
                <>
                    <Button className={styles.previewAction} disabled><Icon name="preview" /> Посмотреть сайт</Button>
                    <Button className={styles.publishAction} variant="success" disabled><Icon name="publish" /> <span>Опубликовать</span></Button>
                </>
            )}
        </Card>
    );
}
