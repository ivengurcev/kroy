
import Field from './Field.jsx';
import styles from './PartEditor.module.css';

export default function PartEditor({
    part,
    props,
    fields,
    onPropChange,
}) {
    return (
        <section className={styles.editor}>
            <h3>{part}</h3>

            {Object.entries(fields).map(([name, schema]) => (
                <Field
                    key={name}
                    name={name}
                    schema={schema}
                    value={props[name]}
                    onChange={(value) => onPropChange(name, value)}
                />
            ))}
        </section>
    );
}
