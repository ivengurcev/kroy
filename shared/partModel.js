
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

function partView(name, metadata, widgetMetadata, props) {
    const widget = widgetMetadata[name];
    if (!widget) throw new Error(`Виджет не найден: ${name}`);
    if (!metadata.contract || metadata.contract !== widget.contract) {
        throw new Error(`Виджет ${name} несовместим с контрактом ${metadata.contract}`);
    }
    return createView(name, widget.fields, props);
}

export function changePartView(item, name, metadata, widgetMetadata) {
    return { ...item, view: partView(name, metadata, widgetMetadata) };
}

export function createPart(part, metadata, widgetMetadata, props = {}, view) {
    const id = globalThis.crypto?.randomUUID?.()
        ?? `part-${Date.now()}-${++sequence}`;

    const item = {
        id,
        part,
        props: {
            ...defaultProps(metadata.fields),
            ...props,
        },
    };

    item.view = partView(view ? view.name : metadata.defaultWidget, metadata, widgetMetadata, view?.props);

    return item;
}
