import { normalizeImageSource } from '../../../shared/imageSource.mjs';

function normalizeHref(value) {
    if (!value || /[\u0000-\u0020\u007f\\]/.test(value) || value.startsWith('//')) return '';
    const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(value);
    if (hasScheme && !/^https?:\/\//i.test(value)) return '';
    try {
        const url = new URL(value, 'https://cta.invalid/');
        return ['http:', 'https:'].includes(url.protocol) ? value : '';
    } catch {
        return '';
    }
}

/**
 * @kroy-title Кнопка действия
 * @kroy-category Основное
 * @kroy-contract cta
 * @kroy-default-widget @kroy/cta
 *
 * @param {object} props
 * @param {string} [props.title] - Основная надпись
 * @param {string} [props.subtitle] - Дополнительная строка
 * @param {string} [props.price] - Ценовая метка (текст, не сумма оплаты)
 * @param {string} [props.icon] - Иконка
 * @param {string} [props.href] - Адрес перехода
 *
 * @kroy title widget=input
 * @kroy subtitle widget=input
 * @kroy price widget=input
 * @kroy icon widget=image format=media maxWidth=512
 * @kroy href widget=input
 */
export default function prepareCta({ props = {} }) {
    const text = (value) => typeof value === 'string' ? value.trim() : '';
    return {
        title: text(props.title),
        subtitle: text(props.subtitle),
        price: text(props.price),
        icon: normalizeImageSource(props.icon),
        href: normalizeHref(text(props.href)),
    };
}
