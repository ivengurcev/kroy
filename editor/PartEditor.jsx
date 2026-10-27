
import Field from './Field.jsx';
import styles from './PartEditor.module.css';

export default function PartEditor({
    title,
    props,
    fields,
    catalog,
    onPropChange,
}) {
    return (
        <section className={styles.editor}>
            <h3>{title}</h3>

            {Object.entries(fields).map(([name, schema]) => (
                <Field
                    key={name}
                    name={name}
                    schema={schema}
                    value={props[name]}
                    catalog={catalog}
                    onChange={(value) => onPropChange(name, value)}
                />
            ))}
        </section>
    );
}
