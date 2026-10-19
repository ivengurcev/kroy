
import { defaultProps } from './partModel.js';
import styles from './ListField.module.css';
import Button from '../components/ui/Button.jsx';
import Icon from '../components/ui/Icon.jsx';

export default function ListField({
    label,
    fields,
    value,
    onChange,
    FieldComponent,
}) {
    const items = Array.isArray(value) ? value : [];

    function addItem() {
        onChange([...items, defaultProps(fields)]);
    }

    function removeItem(index) {
        onChange(items.filter((_, i) => i !== index));
    }

    function updateItem(index, name, value) {
        onChange(
            items.map((item, i) =>
                i === index
                    ? { ...item, [name]: value }
                    : item
            )
        );
    }

    function moveItem(index, direction) {
        const target = index + direction;

        if (target < 0 || target >= items.length) return;

        const next = [...items];

        [next[index], next[target]] = [
            next[target],
            next[index],
        ];

        onChange(next);
    }

    return (
        <fieldset className={styles.listField}>
            <legend>{label}</legend>

            {items.map((item, index) => (
                <div className={styles.listItem} key={index}>
                    <strong>Элемент {index + 1}</strong>

                    {Object.entries(fields).map(([name, schema]) => (
                        <FieldComponent
                            key={name}
                            name={name}
                            schema={schema}
                            value={item?.[name]}
                            onChange={(value) =>
                                updateItem(index, name, value)
                            }
                        />
                    ))}

                    <div className={styles.listActions}>
                        <Button
                            variant="compact"
                            aria-label="Переместить вверх"
                            disabled={index === 0}
                            onClick={() => moveItem(index, -1)}
                        >
                            <Icon name="up" />
                        </Button>

                        <Button
                            variant="compact"
                            aria-label="Переместить вниз"
                            disabled={index === items.length - 1}
                            onClick={() => moveItem(index, 1)}
                        >
                            <Icon name="down" />
                        </Button>

                        <Button
                            onClick={() => removeItem(index)}
                        >
                            <Icon name="delete" /> Удалить
                        </Button>
                    </div>
                </div>
            ))}

            <Button onClick={addItem}>
                <Icon name="add" /> Добавить
            </Button>
        </fieldset>
    );
}
