/**
 * @kroy-title Сравнение категорий
 * @kroy-category Контент
 * @kroy-contract comparison
 * @kroy-default-widget @kroy/comparison-rows
 *
 * @param {object} props
 * @param {string} [props.title] - Заголовок
 * @param {string} [props.subtitle] - Подзаголовок
 * @param {{title: string, description: string, highlight: string, note: string, tone: 'accent'|'success'|'warning'|'danger', examples: string}[]} [props.rows] - Категории
 *
 * @kroy rows.title label=Название
 * @kroy rows.description widget=textarea label=Описание
 * @kroy rows.highlight label="Выделенный показатель"
 * @kroy rows.note widget=textarea label=Примечание
 * @kroy rows.tone label="Цветовой акцент" optionLabels=accent:Основной,success:Зелёный,warning:Жёлтый,danger:Красный
 * @kroy rows.examples widget=textarea label="Примеры — каждый с новой строки"
 */
export default function prepareComparison({ props = {} }) {
    const text = (value) => typeof value === 'string' ? value.trim() : '';
    const paragraphs = (value) => text(value).split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean);
    const rows = Array.isArray(props.rows)
        ? props.rows.map((row) => ({
            title: text(row?.title),
            description: paragraphs(row?.description),
            highlight: text(row?.highlight),
            note: paragraphs(row?.note),
            tone: ['accent', 'success', 'warning', 'danger'].includes(row?.tone) ? row.tone : 'accent',
            examples: text(row?.examples).split(/\r\n?|\n/).map((example) => example.trim()).filter(Boolean),
        })).filter(({ title, description, highlight, note, examples }) => title || description.length || highlight || note.length || examples.length)
        : [];
    return { title: text(props.title), subtitle: text(props.subtitle), rows };
}
