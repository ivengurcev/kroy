import { normalizeImageSource } from '../../../shared/imageSource.mjs';

/**
 * @kroy-title Акцентный блок
 * @kroy-category Контент
 * @kroy-contract callout
 * @kroy-default-widget @kroy/callout
 *
 * @param {object} props
 * @param {string} [props.title] - Заголовок
 * @param {string} [props.text] - Текст
 * @param {string} [props.icon] - Иконка
 *
 * @kroy title widget=input
 * @kroy text widget=textarea
 * @kroy icon widget=image format=media maxWidth=512
 */
export default function prepareCallout({ props = {} }) {
    const title = typeof props.title === 'string' ? props.title.trim() : '';
    const text = typeof props.text === 'string' ? props.text.trim() : '';
    const paragraphs = text.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean);
    return { title, paragraphs, icon: normalizeImageSource(props.icon) };
}
