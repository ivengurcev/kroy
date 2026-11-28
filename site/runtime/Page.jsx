import { WidgetDisplayContext } from './widgetDisplay.js';
import styles from './pageMenu.module.css';

export default function Page({ content, parts, widgets = {}, contacts, catalog, reviews, materials, materialSectionId, context = { params: {} }, record = null, anchorTargets }) {
    return content.map((block, index) => {
        const { id, part, props, view } = block;
        const prepare = Object.hasOwn(parts, part) ? parts[part] : null;
        if (!prepare) return (
            <section key={id ?? index} aria-label="Недоступный блок">
                <p>Запчасть недоступна: {part}</p>
            </section>
        );
        if (!view) throw new Error(`Не выбран виджет запчасти: ${part}`);

        const data = prepare({ props, record, context, contacts, catalog, reviews, materials, materialSectionId });
        const Widget = widgets[view.name];
        if (!Widget) throw new Error(`Виджет не найден: ${view.name}`);

        const anchor = anchorTargets?.get(block);
        const widget = <Widget data={data} options={view.props} context={context} />;
        return (
            <WidgetDisplayContext.Provider key={id ?? index} value={view.props ?? {}}>
                {anchor ? <div id={anchor} tabIndex={-1} data-page-menu-anchor className={styles.anchor}>{widget}</div> : widget}
            </WidgetDisplayContext.Provider>
        );
    });
}
