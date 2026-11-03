
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
    materialSections,
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
                <h4>Данные</h4>
                {Object.entries(fields).map(([name, schema]) => (
                    <Field
                        key={name}
                        name={name}
                        schema={schema}
                        value={props[name]}
                        catalog={catalog}
                        reviews={reviews}
                        materialSections={materialSections}
                        onChange={(value) => onPropChange(name, value)}
                    />
                ))}
            </div>

            {compatibleWidgets.length > 0 && (
                <div className={styles.section}>
                    <h4>Отображение</h4>
                    <label className={styles.viewField}>
                        <select value={view.name} onChange={(event) => onViewChange(event.target.value)}>
                            {compatibleWidgets.map(([name, metadata]) => (
                                <option value={name} key={name}>{metadata.title}</option>
                            ))}
                        </select>
                    </label>

                    {Object.entries(widgetMetadata[view.name]?.fields ?? {}).map(([name, schema]) => (
                        <Field
                            key={name}
                            name={name}
                            schema={schema}
                            value={view.props[name]}
                            catalog={catalog}
                            reviews={reviews}
                            materialSections={materialSections}
                            onChange={(value) => onViewPropChange(name, value)}
                        />
                    ))}
                </div>
            )}
        </section>
    );
}
