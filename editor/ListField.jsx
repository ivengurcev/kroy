
import { defaultProps } from './partModel.js';
import styles from './ListField.module.css';

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
                        <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => moveItem(index, -1)}
                        >
                            ↑
                        </button>

                        <button
                            type="button"
                            disabled={index === items.length - 1}
                            onClick={() => moveItem(index, 1)}
                        >
                            ↓
                        </button>

                        <button
                            type="button"
                            onClick={() => removeItem(index)}
                        >
                            Удалить
                        </button>
                    </div>
                </div>
            ))}

            <button type="button" onClick={addItem}>
                + Добавить
            </button>
        </fieldset>
    );
}
