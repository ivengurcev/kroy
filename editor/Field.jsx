
import ListField from './ListField.jsx';
import ImageField from './ImageField.jsx';
import styles from './Field.module.css';
import TokenControl from '../components/ui/TokenControls.jsx';

export default function Field({ name, schema, value, onChange }) {
    const label = schema.label ?? name;
    const maxLength = schema.validators?.maxLength;

    if (schema.type === 'list') {
        return (
            <ListField
                label={label}
                fields={schema.fields ?? {}}
                value={value}
                onChange={onChange}
                FieldComponent={Field}
            />
        );
    }

    if (schema.type === 'image') {
        return (
            <ImageField
                label={label}
                value={value}
                onChange={onChange}
            />
        );
    }

    if (schema.type === 'checkbox') {
        return (
            <label className={styles.checkboxField}>
                <input
                    type="checkbox"
                    checked={Boolean(value)}
                    onChange={(event) => onChange(event.target.checked)}
                />
                {label}
            </label>
        );
    }

    let control;

    if (['color', 'font', 'dimension', 'number'].includes(schema.type)) {
        control = <TokenControl type={schema.type} value={value} label={label} units={schema.units} numeric={schema.type === 'number'} onChange={onChange} />;
    } else {
        switch (schema.type) {
            case 'input': {
                const inputType = {
                    phone: 'tel',
                    url: 'url',
                }[schema.validators?.type] ?? 'text';

                control = (
                    <input
                        type={inputType}
                        value={value ?? ''}
                        maxLength={maxLength}
                        onChange={(event) => onChange(event.target.value)}
                    />
                );
                break;
            }

            case 'textarea':
                control = (
                    <textarea
                        rows={4}
                        value={value ?? ''}
                        maxLength={maxLength}
                        onChange={(event) => onChange(event.target.value)}
                    />
                );
                break;

            case 'select':
                control = (
                    <select
                        value={value ?? ''}
                        onChange={(event) => onChange(event.target.value)}
                    >
                        <option value="">Выбрать...</option>
                        {schema.options.map((option) => (
                            <option key={option} value={option}>
                                {option}
                            </option>
                        ))}
                    </select>
                );
                break;

            default:
                control = <small>Неизвестный виджет: {schema.type}</small>;
        }
    }

    return (
        <label className={styles.field}>
            {label}
            {control}
        </label>
    );
}
