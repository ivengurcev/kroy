/**
 * @kroy-title О себе
 * @kroy-contract about
 * @kroy-default-widget @kroy/about
 * @kroy-category Основное
 *
 * @param {object} props
 * @param {string} props.title - Заголовок секции
 * @param {string} props.text - Текст
 *
 * @kroy title widget=textarea
 * @kroy text widget=textarea
 */
export default function prepareAbout({ props }) {
    const { title = '', text = '' } = props;
    const paragraphs = typeof text === 'string'
        ? text.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean)
        : [];
    return { title, paragraphs };
}
