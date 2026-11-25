import { normalizeRichText } from '../../../shared/richText.mjs';

/**
 * @kroy-title Сравнение категорий
 * @kroy-category Контент
 * @kroy-contract comparison
 * @kroy-default-widget @kroy/comparison-rows
 *
 * @param {object} props
 * @param {string} [props.title] - Заголовок
 * @param {string} [props.subtitle] - Подзаголовок
 * @param {{tone: 'accent'|'success'|'warning'|'danger', title: string, description: string, note: string, examples: string}[]} [props.rows] - Категории
 *
 * @kroy rows.tone label="Цветовой акцент" optionLabels=accent:Основной,success:Зелёный,warning:Жёлтый,danger:Красный
 * @kroy rows.title label=Название
 * @kroy rows.description widget=richtext label=Описание
 * @kroy rows.note widget=richtext label=Примечание
 * @kroy rows.examples widget=richtext label=Примеры
 */
export default function prepareComparison({ props = {} }) {
    const text = (value) => typeof value === 'string' ? value.trim() : '';
    const rows = Array.isArray(props.rows)
        ? props.rows.map((row) => ({
            title: text(row?.title),
            description: normalizeRichText(row?.description),
            note: normalizeRichText(row?.note),
            tone: ['accent', 'success', 'warning', 'danger'].includes(row?.tone) ? row.tone : 'accent',
            examples: normalizeRichText(row?.examples),
        })).filter(({ title, description, note, examples }) => title || description || note || examples)
        : [];
    return { title: text(props.title), subtitle: text(props.subtitle), rows };
}
