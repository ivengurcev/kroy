
import ListField from './ListField.jsx';
import ImageField from './ImageField.jsx';
import styles from './Field.module.css';
import TokenControl from '../components/ui/TokenControls.jsx';
import Button from '../components/ui/Button.jsx';
import Icon from '../components/ui/Icon.jsx';
import compactStyles from '../components/ui/CompactForm.module.css';

function CatalogProductField({ value, onChange, catalog }) {
    const selected = Array.isArray(value) ? value : [];
    const products = catalog?.products?.filter((product) => product.status === 'published') ?? [];
    function toggle(id) { onChange(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]); }
    function move(index, direction) { const target = index + direction; if (target < 0 || target >= selected.length) return; const next = [...selected]; [next[index], next[target]] = [next[target], next[index]]; onChange(next); }
    return <div className={styles.field}><span>Товары</span><div className={styles.catalogOptions}>{products.map((product) => <label key={product.id}><input type="checkbox" checked={selected.includes(product.id)} onChange={() => toggle(product.id)} /> {product.name}</label>)}</div><div className={styles.catalogSelected}>{selected.map((id, index) => <div key={id}><span>{products.find((product) => product.id === id)?.name || id}</span><Button variant="compact" title="Выше" disabled={!index} onClick={() => move(index, -1)}><Icon name="up" /></Button><Button variant="compact" title="Ниже" disabled={index === selected.length - 1} onClick={() => move(index, 1)}><Icon name="down" /></Button></div>)}</div></div>;
}

function CatalogCategoryField({ value, onChange, catalog }) {
    return <label className={styles.field}>Категория<select value={value ?? ''} onChange={(event) => onChange(event.target.value)}><option value="">Выбрать...</option>{catalog?.categories?.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>;
}

export default function Field({ name, schema, value, onChange, catalog }) {
    const label = schema.label ?? name;
    const maxLength = schema.validators?.maxLength;

    if (schema.type === 'catalog-products') return <CatalogProductField value={value} onChange={onChange} catalog={catalog} />;
    if (schema.type === 'catalog-category') return <CatalogCategoryField value={value} onChange={onChange} catalog={catalog} />;

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

    const fieldLayout = schema.type === 'textarea' ? compactStyles.long : compactStyles.compact;

    return (
        <label className={`${styles.field} ${compactStyles.field} ${fieldLayout}`}>
            {label}
            {control}
        </label>
    );
}
