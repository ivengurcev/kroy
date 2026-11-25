import { normalizeImageSource } from '../../../shared/imageSource.mjs';
import { socialType } from '../../../shared/socialLinks.mjs';
import { normalizeRichText } from '../../../shared/richText.mjs';

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
 * @param {{icon: string, text: string}[]} [props.features] - Тезисы
 * @param {string} props.captionTitle - Заголовок плашки
 * @param {string} props.description - Текст плашки
 * @param {string} props.photo - Фотография
 *
 * @kroy eyebrow widget=input
 * @kroy title widget=textarea
 * @kroy subtitle widget=textarea
 * @kroy lead widget=richtext
 * @kroy features.icon widget=image format=media maxWidth=512 label=Иконка
 * @kroy features.text widget=richtext label=Текст
 * @kroy captionTitle widget=input
 * @kroy description widget=richtext
 * @kroy photo widget=image aspectRatio=3:4 maxWidth=1600
 */
export default function prepareHero({ props, contacts }) {
    const { eyebrow = '', title = '', captionTitle = '', photo = '', subtitle = '' } = props;
    const description = normalizeRichText(props.description);
    const lead = normalizeRichText(props.lead);
    const features = Array.isArray(props.features)
        ? props.features.map((feature) => ({
            icon: normalizeImageSource(feature?.icon),
            text: normalizeRichText(feature?.text),
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
