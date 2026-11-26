import { buildSocialLink, socialLabel, socialType } from '../../../shared/socialLinks.mjs';
import { contactPhoneHref, isValidContactEmail } from '../../../shared/contactLinks.mjs';

/**
 * @kroy-title Футер сайта
 * @kroy-contract footer
 * @kroy-default-widget @kroy/footer
 * @param {object} props
 * @param {string} [props.description] - Описание
 * @param {{pageId: string}[]} [props.navigation] - Навигация
 */
export default function prepareFooter({ props, contacts = {} }) {
    const socials = (contacts.socials ?? []).map((social) => {
        const type = socialType(social);
        return { name: social.name || socialLabel(type), href: buildSocialLink(type, social.value || social.link) };
    }).filter(({ href }) => href);
    return {
        ...props, contacts, socials,
        phoneHref: contactPhoneHref(contacts.phone),
        email: isValidContactEmail(contacts.email) ? contacts.email : '',
    };
}
