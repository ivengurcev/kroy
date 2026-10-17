import styles from './AdminShell.module.css';
import Button from './ui/Button.jsx';
import Card from './ui/Card.jsx';

export default function EditorFooter() {
    return (
        <Card as="footer" className={styles.footer}>
            <nav className={styles.devices} aria-label="Размер предпросмотра">
                <Button className={styles.activeDevice} disabled>▣ <span>Компьютер</span></Button>
                <Button disabled>▯ <span>Планшет</span></Button>
                <Button disabled>▯ <span>Мобильный</span></Button>
            </nav>
            <span className={styles.footerState}>● <span>Все изменения сохранены</span></span>
            <span className={styles.historyActions}><Button variant="compact" disabled>↶</Button><Button variant="compact" disabled>↷</Button></span>
        </Card>
    );
}
