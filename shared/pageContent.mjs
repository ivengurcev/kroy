export function isPlainObject(value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

export function validateContent(content, parts, widgets) {
    const errors = [];
    const add = (path, code, message) => errors.push({ path, code, message });
    if (!Array.isArray(content)) {
        add('content', 'invalid_format', 'Содержимое страницы должно быть массивом блоков.');
        return errors;
    }
    content.forEach((item, index) => {
        const path = `content[${index}]`;
        if (!isPlainObject(item)) {
            add(path, 'invalid_format', 'Блок должен быть объектом.');
            return;
        }
        for (const key of ['part', 'props', 'view']) {
            if (!Object.hasOwn(item, key)) add(`${path}.${key}`, 'required', 'Обязательное поле отсутствует.');
        }
        if (Object.keys(item).some((key) => !['part', 'props', 'view'].includes(key))) add(path, 'invalid_format', 'Блок содержит лишние поля.');
        if (Object.hasOwn(item, 'part')) {
            if (typeof item.part !== 'string') add(`${path}.part`, 'invalid_format', 'Идентификатор запчасти должен быть строкой.');
            else if (!Object.hasOwn(parts, item.part)) add(`${path}.part`, 'unknown_part', 'Запчасть не найдена в реестре сервера.');
        }
        if (Object.hasOwn(item, 'props') && !isPlainObject(item.props)) add(`${path}.props`, 'invalid_format', 'Настройки запчасти должны быть объектом.');
        if (!Object.hasOwn(item, 'view')) return;
        if (!isPlainObject(item.view)) {
            add(`${path}.view`, 'invalid_format', 'Отображение должно быть объектом.');
            return;
        }
        const { view } = item;
        for (const key of ['name', 'props']) {
            if (!Object.hasOwn(view, key)) add(`${path}.view.${key}`, 'required', 'Обязательное поле отсутствует.');
        }
        if (Object.keys(view).some((key) => !['name', 'props'].includes(key))) add(`${path}.view`, 'invalid_format', 'Отображение содержит лишние поля.');
        if (Object.hasOwn(view, 'props') && !isPlainObject(view.props)) add(`${path}.view.props`, 'invalid_format', 'Настройки виджета должны быть объектом.');
        if (Object.hasOwn(view, 'name')) {
            if (typeof view.name !== 'string') add(`${path}.view.name`, 'invalid_format', 'Идентификатор виджета должен быть строкой.');
            else if (!Object.hasOwn(widgets, view.name)) add(`${path}.view.name`, 'unknown_widget', 'Виджет не найден в реестре сервера.');
            else if (typeof item.part === 'string' && Object.hasOwn(parts, item.part)
                && (!parts[item.part].contract || parts[item.part].contract !== widgets[view.name].contract)) {
                add(`${path}.view.name`, 'incompatible_contract', 'Виджет несовместим с контрактом запчасти.');
            }
        }
    });
    return errors;
}

export function isValidContent(content, parts, widgets) {
    return validateContent(content, parts, widgets).length === 0;
}
