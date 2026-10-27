
function publicProps(part, props, contacts, catalog) {
    if (part === '@kroy/product-selection' && catalog) {
        return { ...props, products: props.productIds?.map((id) => catalog.products.find((product) => product.id === id)).filter(Boolean) ?? [] };
    }
    if (part === '@kroy/category-products' && catalog) {
        return { ...props, products: catalog.products.filter((product) => product.categoryId === props.categoryId) };
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

export default function Page({ content, parts, contacts, catalog }) {
    return content.map(({ id, part, props }, index) => {
        const Component = parts[part];

        if (!Component) {
            throw new Error(`Запчасть не найдена: ${part}`);
        }

        return <Component key={id ?? index} {...publicProps(part, props, contacts, catalog)} />;
    });
}
