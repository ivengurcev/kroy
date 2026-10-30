
import Field from './Field.jsx';
import styles from './PartEditor.module.css';

export default function PartEditor({
    title,
    props,
    fields,
    partContract,
    view,
    widgetMetadata,
    catalog,
    reviews,
    onPropChange,
    onViewChange,
    onViewPropChange,
}) {
    const compatibleWidgets = Object.entries(widgetMetadata)
        .filter(([, metadata]) => partContract && metadata.contract === partContract);

    return (
        <section className={styles.editor}>
            <h3>{title}</h3>

            <div className={styles.section}>
                <h4>Настройки данных</h4>
                {Object.entries(fields).map(([name, schema]) => (
                    <Field
                        key={name}
                        name={name}
                        schema={schema}
                        value={props[name]}
                        catalog={catalog}
                        reviews={reviews}
                        onChange={(value) => onPropChange(name, value)}
                    />
                ))}
            </div>

            {compatibleWidgets.length > 0 && (
                <div className={styles.section}>
                    <label className={styles.viewField}>
                        Отображение
                        <select value={view?.name ?? ''} onChange={(event) => onViewChange(event.target.value)}>
                            <option value="">По умолчанию</option>
                            {compatibleWidgets.map(([name, metadata]) => (
                                <option value={name} key={name}>{metadata.title}</option>
                            ))}
                        </select>
                    </label>

                    {view && (
                        <>
                            <h4>Настройки виджета</h4>
                            {Object.entries(widgetMetadata[view.name]?.fields ?? {}).map(([name, schema]) => (
                                <Field
                                    key={name}
                                    name={name}
                                    schema={schema}
                                    value={view.props[name]}
                                    catalog={catalog}
                                    reviews={reviews}
                                    onChange={(value) => onViewPropChange(name, value)}
                                />
                            ))}
                        </>
                    )}
                </div>
            )}
        </section>
    );
}
