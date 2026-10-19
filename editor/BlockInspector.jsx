import { useState } from 'react';
import PartEditor from './PartEditor.jsx';
import styles from './BlockInspector.module.css';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import Icon from '../components/ui/Icon.jsx';
import Tabs from '../components/ui/Tabs.jsx';

const inspectorTabs = [
    { label: 'Контент' },
    { label: 'Оформление' },
    { label: 'Дополнительно' },
];

export default function BlockInspector({
    content,
    metadata,
    selectedPart,
    onAddPart,
    onRemovePart,
    onMovePart,
    onPropChange,
}) {
    const availableParts = Object.keys(metadata);
    const [partToAdd, setPartToAdd] = useState(availableParts[0] ?? '');
    const selectedIndex = selectedPart
        ? content.findIndex(({ id }) => id === selectedPart.id)
        : -1;

    return (
        <Card as="aside" className={styles.inspector}>
            <div className={styles.inspectorTitle}>
                <span>
                    <h1>Редактирование блока</h1>
                    <p>{selectedPart?.part ?? 'Блок не выбран'}</p>
                </span>
            </div>

            <div className={styles.partPicker}>
                <select value={partToAdd} onChange={(event) => setPartToAdd(event.target.value)}>
                    {availableParts.map((name) => <option value={name} key={name}>{name}</option>)}
                </select>
                <Button variant="primary" disabled={!partToAdd} onClick={() => onAddPart(partToAdd)}>
                    <Icon name="add" /> Добавить
                </Button>
            </div>

            <Tabs className={styles.inspectorTabs} items={inspectorTabs} />

            {selectedPart ? (
                <>
                    <div className={styles.partActions}>
                        <Button
                            variant="compact"
                            disabled={selectedIndex === 0}
                            onClick={() => onMovePart(selectedPart.id, -1)}
                            aria-label="Переместить вверх"
                        >
                            <Icon name="up" />
                        </Button>
                        <Button
                            variant="compact"
                            disabled={selectedIndex === content.length - 1}
                            onClick={() => onMovePart(selectedPart.id, 1)}
                            aria-label="Переместить вниз"
                        >
                            <Icon name="down" />
                        </Button>
                        <Button onClick={() => onRemovePart(selectedPart.id)}><Icon name="delete" /> Удалить</Button>
                    </div>

                    <PartEditor
                        part={selectedPart.part}
                        props={selectedPart.props}
                        fields={metadata[selectedPart.part]?.fields ?? {}}
                        onPropChange={(name, value) => onPropChange(selectedPart.id, name, value)}
                    />
                </>
            ) : (
                <p className={styles.emptyInspector}>
                    Выберите блок в предпросмотре или добавьте новую запчасть.
                </p>
            )}
        </Card>
    );
}
