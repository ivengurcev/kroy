export const spacingFields = Object.fromEntries([
    ['spacingTop', 'Отступ сверху'],
    ['spacingBottom', 'Отступ снизу'],
].map(([name, label]) => [name, {
    type: 'select',
    label,
    default: 'auto',
    options: ['auto', 'none', 'small', 'normal', 'large'],
    optionLabels: {
        auto: 'По умолчанию',
        none: 'Без отступа',
        small: 'Малый',
        normal: 'Обычный',
        large: 'Большой',
    },
}]));

const spacingValues = {
    none: '0',
    small: 'calc(var(--site-section-gap) / 4)',
    normal: 'calc(var(--site-section-gap) / 2)',
    large: 'var(--site-section-gap)',
};

export function widgetSpacingStyle(options = {}) {
    const style = {};
    for (const [name, property] of [['spacingTop', 'paddingTop'], ['spacingBottom', 'paddingBottom']]) {
        if (Object.hasOwn(spacingValues, options[name])) style[property] = spacingValues[options[name]];
    }
    return style;
}

export function commonWidgetProps(props = {}) {
    return Object.fromEntries(Object.keys(spacingFields)
        .filter((name) => Object.hasOwn(props, name))
        .map((name) => [name, props[name]]));
}
