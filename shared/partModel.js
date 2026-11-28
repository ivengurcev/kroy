
import { commonWidgetProps } from './widgetDisplay.js';
import { isPageMenuAnchor, MENU_PART, PAGE_MENU_ITEM } from './pageMenu.mjs';

let sequence = 0;

export function defaultValue(schema) {
    if (schema.default !== undefined) return schema.default;

    switch (schema.type) {
        case 'number':
            return 0;

        case 'checkbox':
        case 'switch':
            return false;

        case 'select':
            return schema.options?.[0] ?? '';

        case 'list':
        case 'catalog-products':
        case 'review-list':
            return [];

        case 'material-section':
        case 'richtext':
            return '';

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
    return { ...item, view: partView(name, metadata, widgetMetadata, commonWidgetProps(item.view.props)) };
}

export function changePageMenuAnchor(setting, enabled) {
    if (isPageMenuAnchor(setting)) return { id: setting.id, enabled };
    // getRandomValues is also available when editing on an HTTP development host.
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    return { id, enabled };
}

export function createPart(part, metadata, widgetMetadata, props = {}, view) {
    const id = globalThis.crypto?.randomUUID?.()
        ?? `part-${Date.now()}-${++sequence}`;

    const item = {
        id,
        part,
        props: {
            ...defaultProps(metadata?.fields),
            ...(part === MENU_PART ? { items: [PAGE_MENU_ITEM] } : {}),
            ...props,
        },
    };

    if (!metadata && view) {
        item.view = { name: view.name, props: { ...view.props } };
        return item;
    }

    item.view = partView(view ? view.name : metadata.defaultWidget, metadata, widgetMetadata, view?.props);

    return item;
}
