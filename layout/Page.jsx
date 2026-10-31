
function publicProps(part, props, contacts, catalog, reviews) {
    if (part === '@kroy/product-selection' && catalog) {
        return { ...props, products: props.productIds?.map((id) => catalog.products.find((product) => product.id === id)).filter(Boolean) ?? [] };
    }
    if (part === '@kroy/category-products' && catalog) {
        return { ...props, products: catalog.products.filter((product) => props.categoryId === '__all__'
            || props.categoryId === '__uncategorized__' && !product.categoryId
            || product.categoryId === props.categoryId) };
    }
    if (part === '@kroy/reviews' && reviews) {
        const selected = props.mode === 'manual'
            ? (props.reviewIds ?? []).map((id) => reviews.find((review) => review.id === id)).filter(Boolean)
            : reviews.slice(0, Number(props.limit) > 0 ? Number(props.limit) : undefined);
        return { ...props, reviews: selected };
    }
    if (!contacts) return props;

    if (part === '@kroy/hero' || part === '@kroy/links') {
        return { ...props, socials: contacts.socials };
    }

    if (part === '@kroy/contacts') {
        return { ...props, ...contacts };
    }

    return props;
}

export default function Page({ content, parts, widgets = {}, contacts, catalog, reviews, context = { params: {} }, record = null }) {
    return content.map(({ id, part, props, view }, index) => {
        if (!view) {
            const Component = parts[part];

            if (!Component) {
                throw new Error(`Запчасть не найдена: ${part}`);
            }

            return <Component key={id ?? index} {...publicProps(part, props, contacts, catalog, reviews)} context={context} record={record} />;
        }

        const Widget = widgets[view.name];

        if (!Widget) {
            throw new Error(`Виджет не найден: ${view.name}`);
        }

        const preparedProps = publicProps(part, props, contacts, catalog, reviews);

        return <Widget key={id ?? index} data={preparedProps} options={view.props} context={context} record={record} />;
    });
}
