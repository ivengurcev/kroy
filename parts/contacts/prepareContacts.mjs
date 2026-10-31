/**
 * @kroy-title Контакты
 * @kroy-contract contacts
 * @kroy-default-widget @kroy/contacts
 * @kroy-category Основное
 *
 * @param {object} props
 * @param {string} props.title - Заголовок секции
 * @param {number} props.zoom - Масштаб карты
 * @param {string} props.markerText - Подпись маркера
 *
 * @kroy title widget=textarea
 * @kroy zoom widget=number
 * @kroy markerText widget=input
 */
export default function prepareContacts({ props, contacts }) {
    const { title = '', zoom = 14, markerText = '', address = '', hours = '', phone = '', latitude = null, longitude = null } = { ...props, ...contacts };
    const target = (typeof phone === 'string' ? phone.trim() : '').replace(/[^+\d]/g, '');
    return {
        title, zoom, markerText, address, hours, phone, latitude, longitude,
        phoneHref: /\d/.test(target) ? `tel:${target}` : null,
        hasCoordinates: Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude)),
    };
}
