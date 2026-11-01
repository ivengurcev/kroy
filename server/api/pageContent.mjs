export function isPlainObject(value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

export function isValidContent(content, parts, widgets) {
    return Array.isArray(content) && content.every((item) => {
        if (!isPlainObject(item) || Object.keys(item).length !== 3
            || !Object.hasOwn(item, 'part') || !Object.hasOwn(item, 'props') || !Object.hasOwn(item, 'view')
            || typeof item.part !== 'string' || !Object.hasOwn(parts, item.part)
            || !isPlainObject(item.props)) return false;

        const { view } = item;
        return isPlainObject(view) && Object.keys(view).length === 2
            && Object.hasOwn(view, 'name') && Object.hasOwn(view, 'props')
            && typeof view.name === 'string' && Object.hasOwn(widgets, view.name)
            && isPlainObject(view.props)
            && Boolean(parts[item.part].contract)
            && parts[item.part].contract === widgets[view.name].contract;
    });
}
