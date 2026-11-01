import { socialType } from '../../../shared/socialLinks.mjs';

/**
 * @kroy-title Ссылки
 * @kroy-contract links
 * @kroy-default-widget @kroy/links
 * @kroy-category Контакты
 *
 * @param {object} props
 * @param {string} props.title - Заголовок секции
 *
 * @kroy title widget=input
 */
export default function prepareLinks({ props, contacts }) {
    const { title = '' } = props;
    const socials = Array.isArray(contacts?.socials)
        ? contacts.socials.filter(({ name, link }) => name?.trim() && link?.trim())
            .map((social) => ({ name: social.name.trim(), link: social.link.trim(), type: socialType(social) }))
        : [];
    return { title, socials };
}
