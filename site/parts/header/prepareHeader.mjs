/**
 * @kroy-title Шапка сайта
 * @kroy-contract header
 * @kroy-default-widget @kroy/header
 * @param {object} props
 * @param {string} [props.title] - Название
 * @param {{pageId: string}[]} [props.navigation] - Навигация
 */
export default function prepareHeader({ props, context }) {
    return {
        title: props.title?.trim() || context.siteName,
        navigation: (props.navigation ?? []).filter(({ href }) => href),
    };
}
