
import { parse } from 'comment-parser';

export function extractJsdoc(source) {
    const match = source.match(
        /(\/\*\*(?:(?!\*\/)[\s\S])*\*\/)\s*export\s+default\b/
    );

    return match?.[1] ?? null;
}

function parseType(type) {
    type = type.trim();

    switch (type) {
        case 'string':
            return { type: 'input' };
        case 'number':
            return { type: 'number' };
        case 'boolean':
            return { type: 'checkbox' };
    }

    // 'left'|'center'|'right' → select
    const options = type.split('|').map(value => value.trim());

    if (
        options.length > 1 &&
        options.every(value => /^(['"]).*\1$/.test(value))
    ) {
        return {
            type: 'select',
            options: options.map(value => value.slice(1, -1)),
        };
    }

    // {name: string, link: string}[] → list
    const list = type.match(/^\{(.+)\}\[\]$/s);

    if (list) {
        const fields = {};

        for (const property of list[1].split(',')) {
            const separator = property.indexOf(':');

            if (separator === -1) {
                throw new Error(`Некорректное поле списка: ${property}`);
            }

            const name = property.slice(0, separator).trim();
            const fieldType = property.slice(separator + 1).trim();

            if (!name || !fieldType) {
                throw new Error(`Некорректное поле списка: ${property}`);
            }

            fields[name] = parseType(fieldType);
        }

        return { type: 'list', fields };
    }

    throw new Error(`Неподдерживаемый JSDoc-тип: ${type}`);
}

function findField(fields, path) {
    const segments = path.split('.');
    let field = fields[segments.shift()];

    for (const segment of segments) {
        field = field?.fields?.[segment];
    }

    if (!field) {
        throw new Error(`Поле для @kroy не найдено: ${path}`);
    }

    return field;
}

function applyKroy(field, settings) {
    for (const option of settings.split(/\s+/).filter(Boolean)) {
        const separator = option.indexOf('=');

        if (separator === -1) {
            throw new Error(`Некорректная настройка @kroy: ${option}`);
        }

        const key = option.slice(0, separator);
        const value = option.slice(separator + 1);

        if (!key || !value) {
            throw new Error(`Некорректная настройка @kroy: ${option}`);
        }

        switch (key) {
            case 'label':
                field.label = value;
                break;

            case 'widget':
                // Совместимость с текущим редактором
                if (value === 'tel' || value === 'url') {
                    field.type = 'input';
                    field.validators ??= {};
                    field.validators.type =
                        value === 'tel' ? 'phone' : 'url';
                } else {
                    field.type = value;
                }
                break;

            case 'maxLength': {
                const length = Number(value);

                if (!Number.isInteger(length) || length < 0) {
                    throw new Error(`Некорректный maxLength: ${value}`);
                }

                field.validators ??= {};
                field.validators.maxLength = length;
                break;
            }

            case 'format':
                field.format = value;
                break;

            default:
                throw new Error(`Неизвестная настройка @kroy: ${key}`);
        }
    }
}

export function parsePartDoc(source) {
    const jsdoc = extractJsdoc(source);

    if (!jsdoc) return {};

    const [block] = parse(jsdoc);
    if (!block) return {};

    const fields = {};

    // Сначала стандартные аннотации.
    for (const tag of block.tags) {
        if (tag.tag !== 'param') continue;
        if (!tag.name.startsWith('props.')) continue;

        const name = tag.name.slice('props.'.length);

        if (name.includes('.')) {
            throw new Error(`Вложенный @param пока не поддерживается: ${name}`);
        }

        const field = parseType(tag.type);

        if (tag.description) {
            field.label = tag.description.replace(/^-\s*/, '');
        }

        field.required = !tag.optional;
        fields[name] = field;
    }

    // Затем настройки Kroy.
    for (const tag of block.tags) {
        if (tag.tag !== 'kroy') continue;

        const field = findField(fields, tag.name);
        applyKroy(field, tag.description);
    }

    return fields;
}
