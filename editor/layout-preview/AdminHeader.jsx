import styles from './AdminShell.module.css';
import KroyLogo from '../../design/kroy-logo.svg';
import Button from './ui/Button.jsx';
import Card from './ui/Card.jsx';

export default function AdminHeader() {
    return (
        <Card className={styles.primaryBar}>
            <div className={styles.logo} aria-label="Kroy">
                <KroyLogo className={styles.logoMark} aria-hidden="true" />
                <strong>Kroy</strong>
            </div>

            <Button className={styles.headerTile} disabled>
                <span className={styles.tileIcon}>⚙︎</span>
                <span><b>Настройки сайта</b><small>Дизайн, меню, контакты</small></span>
                <i>›</i>
            </Button>

            <Button className={styles.headerTile} disabled>
                <span className={styles.tileIcon}>≡</span>
                <span><b>Карта страниц</b><small>Все страницы сайта</small></span>
                <i>›</i>
            </Button>

            <section className={styles.currentPage}>
                <span className={styles.tileIcon}>⌂</span>
                <span className={styles.pageName}><small>Текущая страница</small><b>Главная <i>✎</i></b></span>
                <span className={styles.pageAddress}>
                    <small>Адрес страницы</small>
                    <span><code>/</code><Button variant="compact" disabled>✎ <em>Изменить</em></Button></span>
                </span>
            </section>

            <Button className={styles.previewAction} disabled>Посмотреть сайт ↗</Button>
            <Button className={styles.publishAction} variant="success" disabled><b className={styles.actionIcon}>↥</b> <span>Опубликовать</span></Button>
        </Card>
    );
}
