
import ListField from './ListField.jsx';
import ImageField from './ImageField.jsx';
import RelatedItemsField from './RelatedItemsField.jsx';
import styles from './Field.module.css';
import TokenControl from '../ui/TokenControls.jsx';
import compactStyles from '../ui/CompactForm.module.css';

function MaterialSectionField({ value, onChange, materialSections }) {
    return <label className={styles.field}>Раздел материалов<select value={value ?? ''} onChange={(event) => onChange(event.target.value)}><option value="">Выбрать...</option>{(materialSections ?? []).map((section) => <option value={section.id} key={section.id}>{section.name}</option>)}</select></label>;
}

function CatalogCategoryField({ value, onChange, catalog }) {
    return <label className={styles.field}>Категория<select value={value ?? ''} onChange={(event) => onChange(event.target.value)}><option value="">Выбрать...</option><option value="__all__">Все товары</option><option value="__uncategorized__">Без категории</option>{catalog?.categories?.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>;
}

export default function Field({ name, schema, value, onChange, catalog, reviews, materialSections }) {
    const label = schema.label ?? name;
    const maxLength = schema.validators?.maxLength;

    if (schema.type === 'catalog-products') return <RelatedItemsField label="Товары" items={catalog?.products?.filter((product) => product.status === 'published') ?? []} value={value} onChange={onChange} getId={(product) => product.id} getLabel={(product) => product.name} />;
    if (schema.type === 'material-section') return <MaterialSectionField value={value} onChange={onChange} materialSections={materialSections} />;
    if (schema.type === 'catalog-category') return <CatalogCategoryField value={value} onChange={onChange} catalog={catalog} />;
    if (schema.type === 'review-list') return <RelatedItemsField label="Отзывы" items={reviews ?? []} value={value} onChange={onChange} getId={(review) => review.id} getLabel={(review) => review.authorName} />;

    if (schema.type === 'list') {
        return (
            <ListField
                label={label}
                itemLabel={schema.itemLabel}
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
                aspectRatio={schema.aspectRatio}
                maxWidth={schema.maxWidth}
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
        control = <TokenControl type={schema.type} value={value} label={label} units={schema.units} numeric={schema.type === 'number'} min={schema.min} max={schema.max} onChange={onChange} />;
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
