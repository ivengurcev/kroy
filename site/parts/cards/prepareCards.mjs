import { normalizeImageSource } from '../../../shared/imageSource.mjs';

/**
 * @kroy-title Карточки
 * @kroy-category Контент
 * @kroy-contract cards
 * @kroy-default-widget @kroy/feature-cards
 *
 * @param {object} props
 * @param {string} [props.title] - Заголовок секции
 * @param {string} [props.headingIcon] - Иконка заголовка
 * @param {{icon: string, title: string, description: string}[]} [props.cards] - Карточки
 *
 * @kroy title widget=input
 * @kroy headingIcon widget=image format=media maxWidth=512
 * @kroy cards.icon widget=image format=media maxWidth=512 label=Иконка
 * @kroy cards.title widget=input label=Название
 * @kroy cards.description widget=textarea label=Описание
 */
export default function prepareCards({ props = {} }) {
    const text = (value) => typeof value === 'string' ? value.trim() : '';
    const cards = Array.isArray(props.cards)
        ? props.cards.map((card) => ({
            icon: normalizeImageSource(card?.icon),
            title: text(card?.title),
            description: text(card?.description),
        })).filter(({ icon, title, description }) => icon || title || description)
        : [];
    return { title: text(props.title), headingIcon: normalizeImageSource(props.headingIcon), cards };
}
