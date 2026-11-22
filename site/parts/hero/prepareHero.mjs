import { socialType } from '../../../shared/socialLinks.mjs';

/**
 * @kroy-title Первый экран
 * @kroy-contract hero
 * @kroy-default-widget @kroy/hero
 * @kroy-category Основное
 *
 * @param {object} props
 * @param {string} props.eyebrow - Надпись над заголовком
 * @param {string} props.title - Главный заголовок
 * @param {string} [props.subtitle] - Вторая строка заголовка
 * @param {string} [props.lead] - Вводный текст
 * @param {{icon: 'none'|'check'|'star'|'heart'|'leaf'|'book'|'shield', text: string}[]} [props.features] - Тезисы
 * @param {string} props.captionTitle - Заголовок плашки
 * @param {string} props.description - Текст плашки
 * @param {string} props.photo - Фотография
 *
 * @kroy eyebrow widget=input
 * @kroy title widget=textarea
 * @kroy subtitle widget=textarea
 * @kroy lead widget=textarea
 * @kroy features.icon label=Иконка
 * @kroy features.icon optionLabels=none:Нет,check:Галочка,star:Звезда,heart:Сердце,leaf:Лист,book:Книга,shield:Щит
 * @kroy features.text widget=textarea label=Текст
 * @kroy captionTitle widget=input
 * @kroy description widget=textarea
 * @kroy photo widget=image aspectRatio=3:4 maxWidth=1600
 */
export default function prepareHero({ props, contacts }) {
    const { eyebrow = '', title = '', captionTitle = '', description = '', photo = '' } = props;
    const { subtitle = '', lead = '' } = props;
    const icons = ['none', 'check', 'star', 'heart', 'leaf', 'book', 'shield'];
    const features = Array.isArray(props.features)
        ? props.features.map((feature) => ({
            icon: icons.includes(feature?.icon) ? feature.icon : 'none',
            text: typeof feature?.text === 'string' ? feature.text.trim() : '',
        })).filter(({ text }) => text)
        : [];
    const socials = Array.isArray(contacts?.socials)
        ? contacts.socials.map((social) => ({
            type: socialType(social),
            name: typeof social.name === 'string' ? social.name.trim() : '',
            link: typeof social.link === 'string' ? social.link.trim() : '',
        })).filter(({ name, link }) => name && link)
        : [];
    return { eyebrow, title, captionTitle, description, photo, socials, subtitle, lead, features };
}
