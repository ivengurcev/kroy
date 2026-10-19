import styles from './EditorToolbar.module.css';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import Icon from '../components/ui/Icon.jsx';
import StatusIndicator from '../components/ui/StatusIndicator.jsx';
import Tabs from '../components/ui/Tabs.jsx';

const modes = [
    { icon: <Icon name="edit" size={21} />, label: 'Редактирование' },
    { icon: <Icon name="settings" size={21} />, label: 'Настройки' },
    { icon: <Icon name="seo" size={21} />, label: 'SEO' },
    { icon: <Icon name="more" size={21} />, label: 'Дополнительно' },
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
                    <Button variant="compact" aria-label="Назад" disabled><Icon name="back" /></Button>
                    <Button variant="compact" aria-label="Вперёд" disabled><Icon name="forward" /></Button>
                </span>
                <StatusIndicator className={styles.saveState} title={status.title} tone={status.tone} />
                <Button
                    className={styles.saveAction}
                    variant="primary"
                    disabled={loadStatus !== 'success' || !isDirty || saveStatus === 'saving'}
                    onClick={onSave}
                >
                    <Icon name="save" /> <span>{saveStatus === 'saving' ? 'Сохранение…' : 'Сохранить'}</span>
                </Button>
            </div>
        </Card>
    );
}
