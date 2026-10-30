
let sequence = 0;

export function defaultValue(schema) {
    if (schema.default !== undefined) return schema.default;

    switch (schema.type) {
        case 'number':
            return 0;

        case 'checkbox':
            return false;

        case 'select':
            return schema.options?.[0] ?? '';

        case 'list':
        case 'catalog-products':
        case 'review-list':
            return [];

        default:
            return '';
    }
}

export function defaultProps(fields = {}) {
    return Object.fromEntries(
        Object.entries(fields).map(([name, schema]) => [
            name,
            defaultValue(schema),
        ])
    );
}

export function createView(name, fields = {}, props = {}) {
    return {
        name,
        props: {
            ...defaultProps(fields),
            ...props,
        },
    };
}

export function createPart(part, fields = {}, props = {}, view) {
    const id = globalThis.crypto?.randomUUID?.()
        ?? `part-${Date.now()}-${++sequence}`;

    const item = {
        id,
        part,
        props: {
            ...defaultProps(fields),
            ...props,
        },
    };

    if (view) {
        item.view = createView(view.name, {}, view.props);
    }

    return item;
}
