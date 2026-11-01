import { socialType } from '../../../socialLinks.mjs';

/**
 * @kroy-title Первый экран
 * @kroy-contract hero
 * @kroy-default-widget @kroy/hero
 * @kroy-category Основное
 *
 * @param {object} props
 * @param {string} props.eyebrow - Надпись над заголовком
 * @param {string} props.title - Главный заголовок
 * @param {string} props.captionTitle - Заголовок плашки
 * @param {string} props.description - Текст плашки
 * @param {string} props.photo - Фотография
 *
 * @kroy eyebrow widget=input
 * @kroy title widget=textarea
 * @kroy captionTitle widget=input
 * @kroy description widget=textarea
 * @kroy photo widget=image aspectRatio=3:4 maxWidth=1600
 */
export default function prepareHero({ props, contacts }) {
    const { eyebrow = '', title = '', captionTitle = '', description = '', photo = '' } = props;
    const socials = Array.isArray(contacts?.socials)
        ? contacts.socials.map((social) => ({
            type: socialType(social),
            name: typeof social.name === 'string' ? social.name.trim() : '',
            link: typeof social.link === 'string' ? social.link.trim() : '',
        })).filter(({ name, link }) => name && link)
        : [];
    return { eyebrow, title, captionTitle, description, photo, socials };
}
