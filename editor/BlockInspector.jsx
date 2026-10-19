import PartEditor from './PartEditor.jsx';
import styles from './BlockInspector.module.css';
import Card from '../components/ui/Card.jsx';
import Tabs from '../components/ui/Tabs.jsx';

const inspectorTabs = [
    { label: 'Контент' },
    { label: 'Оформление' },
    { label: 'Дополнительно' },
];

export default function BlockInspector({
    metadata,
    selectedPart,
    onPropChange,
}) {
    return (
        <Card as="aside" className={styles.inspector}>
            <div className={styles.inspectorTitle}>
                <span>
                    <h1>Редактирование блока</h1>
                    <p>{selectedPart?.part ?? 'Блок не выбран'}</p>
                </span>
            </div>

            <Tabs className={styles.inspectorTabs} items={inspectorTabs} />

            {selectedPart ? (
                <PartEditor
                    part={selectedPart.part}
                    props={selectedPart.props}
                    fields={metadata[selectedPart.part]?.fields ?? {}}
                    onPropChange={(name, value) => onPropChange(selectedPart.id, name, value)}
                />
            ) : (
                <p className={styles.emptyInspector}>
                    Выберите блок в предпросмотре, чтобы изменить его свойства.
                </p>
            )}
        </Card>
    );
}
