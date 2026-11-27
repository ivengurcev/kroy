/**
 * @kroy-title Правовой документ
 * @kroy-category Основное
 * @kroy-contract document
 * @kroy-default-widget @kroy/document
 * @kroy content widget=richtext
 * @param {object} props
 * @param {string} [props.content] - Содержимое документа
 */
export default function prepareDocument({ props }) {
    return { content: props.content };
}
