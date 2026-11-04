import { useState } from 'react';
import Button from '../ui/Button.jsx';
import Icon from '../ui/Icon.jsx';
import styles from './RelatedItemsField.module.css';
import fieldStyles from './Field.module.css';

export default function RelatedItemsField({ label, items, value, onChange, getId, getLabel }) {
    const selected = Array.isArray(value) ? value : [];
    const [adding, setAdding] = useState(false);
    const availableItems = items.filter((item) => !selected.includes(getId(item)));

    function add(id) {
        if (!id) return;
        const item = availableItems.find((available) => String(getId(available)) === id);
        if (!item) return;
        onChange([...selected, getId(item)]);
        setAdding(false);
    }

    function move(index, direction) {
        const target = index + direction;
        if (target < 0 || target >= selected.length) return;
        const next = [...selected];
        [next[index], next[target]] = [next[target], next[index]];
        onChange(next);
    }

    return (
        <div className={fieldStyles.field}>
            <span>{label}</span>
            <div className={styles.list}>
                {selected.map((id, index) => {
                    const item = items.find((candidate) => getId(candidate) === id);
                    const name = item ? getLabel(item) : id;
                    return (
                        <div className={styles.item} key={id}>
                            <span title={String(name)}>{name || id}</span>
                            <Button variant="iconCompact" title="Переместить выше" aria-label={`Переместить ${name || id} выше`} disabled={!index} onClick={() => move(index, -1)}><Icon name="up" size={18} /></Button>
                            <Button variant="iconCompact" title="Переместить ниже" aria-label={`Переместить ${name || id} ниже`} disabled={index === selected.length - 1} onClick={() => move(index, 1)}><Icon name="down" size={18} /></Button>
                            <Button variant="iconCompact" title="Удалить" aria-label={`Удалить ${name || id}`} onClick={() => onChange(selected.filter((selectedId) => selectedId !== id))}><Icon name="delete" size={18} /></Button>
                        </div>
                    );
                })}
                <div className={`${styles.addRow} ${selected.length ? styles.divided : ''}`}>
                    {adding ? (
                        <select className={styles.addSelect} autoFocus value="" aria-label={`Добавить: ${label}`} onChange={(event) => add(event.target.value)}>
                            <option value="" disabled>Выберите элемент</option>
                            {availableItems.map((item) => <option key={getId(item)} value={getId(item)}>{getLabel(item) || getId(item)}</option>)}
                        </select>
                    ) : (
                        <Button variant="compact" disabled={!availableItems.length} onClick={() => setAdding(true)}>
                            <Icon name="add" size={18} /> Добавить
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
