import { normalizeImageSource } from '../../../shared/imageSource.mjs';
import { normalizeHref } from '../../../shared/safeHref.mjs';

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
