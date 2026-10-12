
import { useState } from 'react';
import PartEditor from './PartEditor.jsx';

export default function PartsPanel({
    content,
    metadata,
    onAdd,
    onRemove,
    onMove,
    onPropChange,
}) {
    const availableParts = Object.keys(metadata);
    const [selected, setSelected] = useState(availableParts[0] ?? '');

    return (
        <aside className="panel">
            <h2>Запчасти</h2>

            <div className="part-picker">
                <select
                    value={selected}
                    onChange={(event) => setSelected(event.target.value)}
                >
                    {availableParts.map((name) => (
                        <option key={name} value={name}>
                            {name}
                        </option>
                    ))}
                </select>

                <button
                    type="button"
                    disabled={!selected}
                    onClick={() => onAdd(selected)}
                >
                    Добавить
                </button>
            </div>

            {content.map(({ id, part, props }, index) => (
                <div className="editable-part" key={id}>
                    <div className="part-actions">
                        <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => onMove(id, -1)}
                            title="Переместить вверх"
                        >
                            ↑
                        </button>

                        <button
                            type="button"
                            disabled={index === content.length - 1}
                            onClick={() => onMove(id, 1)}
                            title="Переместить вниз"
                        >
                            ↓
                        </button>

                        <button
                            type="button"
                            onClick={() => onRemove(id)}
                        >
                            Удалить
                        </button>
                    </div>

                    <PartEditor
                        part={part}
                        props={props}
                        fields={metadata[part]?.fields ?? {}}
                        onPropChange={(name, value) =>
                            onPropChange(id, name, value)
                        }
                    />
                </div>
            ))}

            {content.length === 0 && (
                <p>Страница пуста. Добавь первую запчасть.</p>
            )}
        </aside>
    );
}
