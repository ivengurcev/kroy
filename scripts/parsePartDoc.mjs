
import { parse } from 'comment-parser';

function splitTopLevel(source, delimiter) {
    const parts = [];
    const depths = { '{': 0, '[': 0, '(': 0 };
    const opening = new Set(Object.keys(depths));
    const closing = { '}': '{', ']': '[', ')': '(' };
    let start = 0;

    for (let index = 0; index < source.length; index += 1) {
        const character = source[index];

        if (opening.has(character)) {
            depths[character] += 1;
        } else if (closing[character]) {
            const opener = closing[character];

            if (depths[opener] === 0) {
                throw new Error(`Несбалансированный тип: ${source}`);
            }

            depths[opener] -= 1;
        } else if (
            character === delimiter
            && Object.values(depths).every((depth) => depth === 0)
        ) {
            parts.push(source.slice(start, index));
            start = index + 1;
        }
    }

    if (Object.values(depths).some((depth) => depth !== 0)) {
        throw new Error(`Несбалансированный тип: ${source}`);
    }

    parts.push(source.slice(start));
    return parts;
}

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
        case 'string[]':
            return { type: 'catalog-products' };
    }

    // {name: string, link: string}[] → list
    const list = type.match(/^\{(.+)\}\[\]$/s);

    if (list) {
        const fields = {};

        for (const property of splitTopLevel(list[1], ',')) {
            const segments = splitTopLevel(property, ':');

            if (segments.length !== 2) {
                throw new Error(`Некорректное поле списка: ${property}`);
            }

            const name = segments[0].trim();
            const fieldType = segments[1].trim();

            if (!name || !fieldType) {
                throw new Error(`Некорректное поле списка: ${property}`);
            }

            fields[name] = parseType(fieldType);
        }

        return { type: 'list', fields };
    }

    // 'left'|'center'|'right' → select
    const options = splitTopLevel(type, '|').map(value => value.trim());

    if (
        options.length > 1 &&
        options.every(value => /^(['"]).*\1$/.test(value))
    ) {
        return {
            type: 'select',
            options: options.map(value => value.slice(1, -1)),
        };
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

    if (!jsdoc) return { fields: {} };

    const [block] = parse(jsdoc);
    if (!block) return { fields: {} };

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

    function metadataValue(tagName) {
        const tag = block.tags.find((item) => item.tag === tagName);

        return [tag?.name, tag?.description]
            .filter(Boolean)
            .join(' ')
            .trim();
    }

    return {
        title: metadataValue('kroy-title') || undefined,
        category: metadataValue('kroy-category') || undefined,
        fields,
    };
}
