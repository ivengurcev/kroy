import { normalizeImageSource } from '../../../shared/imageSource.mjs';
import { normalizeRichText } from '../../../shared/richText.mjs';

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
 * @kroy text widget=richtext
 * @kroy icon widget=image format=media maxWidth=512
 */
export default function prepareCallout({ props = {} }) {
    const title = typeof props.title === 'string' ? props.title.trim() : '';
    return { title, text: normalizeRichText(props.text), icon: normalizeImageSource(props.icon) };
}
