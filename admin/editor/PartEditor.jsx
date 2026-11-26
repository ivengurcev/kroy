import { useState } from 'react';
import Tabs from '../ui/Tabs.jsx';
import { spacingFields } from '../../shared/widgetDisplay.js';
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
    const hasData = Object.keys(fields).length > 0;
    const [activeTab, setActiveTab] = useState(0);
    const widgetTab = !hasData || activeTab === 1;
    const widgetFields = widgetMetadata[view.name]?.fields ?? {};
    const specificFields = Object.entries(widgetFields).filter(([name]) => name !== 'heightMode');
    function viewField(name, schema) {
        return <Field
            key={name}
            name={name}
            schema={schema}
            value={view.props[name] ?? schema.default}
            catalog={catalog}
            reviews={reviews}
            materialSections={materialSections}
            onChange={(value) => onViewPropChange(name, value)}
        />;
    }

    return (
        <section className={styles.editor}>
            <h3>{title}</h3>
            <Tabs
                items={hasData ? [{ label: 'Данные' }, { label: 'Виджет' }] : [{ label: 'Виджет' }]}
                activeIndex={hasData ? activeTab : 0}
                ariaLabel="Настройки запчасти"
                onSelect={setActiveTab}
            />

            <div className={styles.section} hidden={widgetTab}>
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
                <div className={styles.section} hidden={!widgetTab}>
                    <label className={styles.viewField}>
                        Виджет
                        <select value={view.name} onChange={(event) => onViewChange(event.target.value)}>
                            {compatibleWidgets.map(([name, metadata]) => (
                                <option value={name} key={name}>{metadata.title}</option>
                            ))}
                        </select>
                    </label>

                    <div className={styles.section}>
                        <h4>Размеры и отступы</h4>
                        {widgetFields.heightMode && viewField('heightMode', widgetFields.heightMode)}
                        {Object.entries(spacingFields).map(([name, schema]) => viewField(name, schema))}
                    </div>
                    {specificFields.length > 0 && <div className={styles.section}>
                        <h4>Параметры виджета</h4>
                        {specificFields.map(([name, schema]) => viewField(name, schema))}
                    </div>}
                </div>
            )}
        </section>
    );
}
