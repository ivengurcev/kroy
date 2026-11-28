import { resolveMenuItems } from '../../../shared/pageMenu.mjs';

/**
 * @kroy-title Меню
 * @kroy-category Навигация
 * @kroy-contract menu
 * @kroy-default-widget @kroy/menu-horizontal
 * @param {object} props
 * @param {{type: string, pageId: string, label: string, url: string}[]} props.items - Пункты меню
 */
export default function prepareMenu({ props, context }) {
    return resolveMenuItems(props.resolvedItems, context.pageMenu?.anchors);
}
