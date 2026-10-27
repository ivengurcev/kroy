
let sequence = 0;

export function defaultValue(schema) {
    switch (schema.type) {
        case 'number':
            return 0;

        case 'checkbox':
            return false;

        case 'select':
            return schema.options?.[0] ?? '';

        case 'list':
        case 'catalog-products':
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

export function createPart(part, fields = {}, props = {}) {
    const id = globalThis.crypto?.randomUUID?.()
        ?? `part-${Date.now()}-${++sequence}`;

    return {
        id,
        part,
        props: {
            ...defaultProps(fields),
            ...props,
        },
    };
}
