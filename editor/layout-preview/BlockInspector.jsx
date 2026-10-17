import styles from './AdminShell.module.css';
import Button from './ui/Button.jsx';
import Card from './ui/Card.jsx';
import FormField from './ui/FormField.jsx';
import Tabs from './ui/Tabs.jsx';

const inspectorTabs = [
    { label: 'Контент' },
    { label: 'Оформление' },
    { label: 'Дополнительно' },
];

export default function BlockInspector() {
    return (
        <Card as="aside" className={styles.inspector}>
            <div className={styles.inspectorTitle}>
                <span><h1>Редактирование блока</h1><p>Герой — Главный экран</p></span>
                <Button variant="compact" aria-label="Закрыть" disabled>×</Button>
            </div>

            <Tabs className={styles.inspectorTabs} items={inspectorTabs} />

            <form className={styles.blockForm}>
                <FormField label="Заголовок">
                    <textarea rows="2" defaultValue="Семейный ветеринарный врач" readOnly />
                </FormField>
                <FormField label="Описание">
                    <textarea rows="2" defaultValue={'Спокойная, бережная помощь\nдля кошек и собак'} readOnly />
                </FormField>
                <FormField label="Кнопка (основная)">
                    <span className={styles.linkedInput}><input defaultValue="Записаться на прием" readOnly /><i>↗</i></span>
                </FormField>
                <FormField label="Ссылка">
                    <select defaultValue="/contacts" disabled><option>/contacts</option></select>
                </FormField>
                <FormField label="Кнопка (вторичная)">
                    <span className={styles.linkedInput}><input defaultValue="Подробнее о клинике" readOnly /><i>↗</i></span>
                </FormField>
                <FormField label="Ссылка">
                    <select defaultValue="/about" disabled><option>/about</option></select>
                </FormField>
                <fieldset className={styles.imageControl}>
                    <legend>Изображение</legend>
                    <div className={styles.imageThumb}><span>◇</span></div>
                    <Button disabled>☁ <span>Заменить</span></Button>
                    <Button disabled>♙ <span>Удалить</span></Button>
                </fieldset>
            </form>
        </Card>
    );
}
