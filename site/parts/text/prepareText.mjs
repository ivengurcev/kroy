/**
 * @kroy-title Текст
 * @kroy-contract text
 * @kroy-default-widget @kroy/text
 * @kroy-category Основное
 *
 * @param {object} props
 * @param {string} props.title - Заголовок секции
 * @param {string} [props.lead] - Вводный акцентный абзац
 * @param {string} props.text - Текст
 * @param {string} [props.photo] - Фотография
 * @param {string} [props.photoAlt] - Описание фотографии
 *
 * @kroy title widget=textarea
 * @kroy text widget=textarea
 * @kroy lead widget=textarea
 * @kroy photo widget=image maxWidth=1600
 * @kroy photoAlt widget=input
 */
export default function prepareText({ props }) {
    const { title = '', text = '' } = props;
    const lead = typeof props.lead === 'string' ? props.lead.trim() : '';
    const photo = typeof props.photo === 'string' ? props.photo.trim() : '';
    const photoAlt = typeof props.photoAlt === 'string' ? props.photoAlt.trim() : '';
    const paragraphs = typeof text === 'string'
        ? text.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean)
        : [];
    return { title, paragraphs, lead, photo, photoAlt };
}
