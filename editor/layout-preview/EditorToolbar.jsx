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

export default function EditorToolbar({
    loadStatus,
    saveStatus,
    isDirty,
    onSave,
}) {
    const status = loadStatus === 'loading'
        ? { title: 'Загрузка…', tone: 'progress' }
        : loadStatus === 'error'
            ? { title: 'Страница не загружена', tone: 'error' }
            : saveStatus === 'saving'
                ? { title: 'Сохранение…', tone: 'progress' }
                : saveStatus === 'error'
                    ? { title: 'Не удалось сохранить', tone: 'error' }
                    : isDirty
                        ? { title: 'Есть несохранённые изменения', tone: 'warning' }
                        : { title: 'Сохранено', tone: 'success' };

    return (
        <Card className={styles.secondaryBar}>
            <Tabs className={styles.modeTabs} items={modes} ariaLabel="Режим редактора" />
            <div className={styles.saveArea}>
                <span className={styles.historyActions} aria-label="История действий">
                    <Button variant="compact" aria-label="Назад" disabled>↶</Button>
                    <Button variant="compact" aria-label="Вперёд" disabled>↷</Button>
                </span>
                <StatusIndicator className={styles.saveState} title={status.title} tone={status.tone} />
                <Button
                    className={styles.saveAction}
                    variant="primary"
                    disabled={loadStatus !== 'success' || !isDirty || saveStatus === 'saving'}
                    onClick={onSave}
                >
                    <b className={styles.actionIcon}>✓</b> <span>{saveStatus === 'saving' ? 'Сохранение…' : 'Сохранить'}</span>
                </Button>
            </div>
        </Card>
    );
}
