import { WidgetDisplayContext } from './widgetDisplay.js';

export default function Page({ content, parts, widgets = {}, contacts, catalog, reviews, materials, materialSectionId, context = { params: {} }, record = null }) {
    return content.map(({ id, part, props, view }, index) => {
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

        return (
            <WidgetDisplayContext.Provider key={id ?? index} value={view.props ?? {}}>
                <Widget data={data} options={view.props} context={context} />
            </WidgetDisplayContext.Provider>
        );
    });
}
