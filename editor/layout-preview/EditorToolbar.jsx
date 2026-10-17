import styles from './AdminShell.module.css';
import Button from './ui/Button.jsx';
import Card from './ui/Card.jsx';
import StatusIndicator from './ui/StatusIndicator.jsx';
import Tabs from './ui/Tabs.jsx';

const modes = [
    { icon: '✎', label: 'Редактирование' },
    { icon: '⚙︎', label: 'Настройки' },
    { icon: 'Aa', label: 'SEO' },
    { icon: '•••', label: 'Дополнительно' },
];

export default function EditorToolbar() {
    return (
        <Card className={styles.secondaryBar}>
            <Tabs className={styles.modeTabs} items={modes} ariaLabel="Режим редактора" />
            <div className={styles.saveArea}>
                <span className={styles.historyActions} aria-label="История действий">
                    <Button variant="compact" aria-label="Назад" disabled>↶</Button>
                    <Button variant="compact" aria-label="Вперёд" disabled>↷</Button>
                </span>
                <StatusIndicator className={styles.saveState} title="Сохранено" details="Изменения сохранены 2 мин. назад" />
                <Button className={styles.saveAction} variant="primary" disabled><b className={styles.actionIcon}>✓</b> <span>Сохранить</span></Button>
            </div>
        </Card>
    );
}
