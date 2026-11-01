export default function Page({ content, parts, widgets = {}, contacts, catalog, reviews, materials, materialSectionId, context = { params: {} }, record = null }) {
    return content.map(({ id, part, props, view }, index) => {
        const prepare = parts[part];
        if (!prepare) throw new Error(`Запчасть не найдена: ${part}`);
        if (!view) throw new Error(`Не выбран виджет запчасти: ${part}`);

        const data = prepare({ props, record, context, contacts, catalog, reviews, materials, materialSectionId });
        const Widget = widgets[view.name];
        if (!Widget) throw new Error(`Виджет не найден: ${view.name}`);

        return <Widget key={id ?? index} data={data} options={view.props} context={context} />;
    });
}
