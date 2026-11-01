/**
 * @kroy-title Услуги
 * @kroy-contract services
 * @kroy-default-widget @kroy/services
 * @kroy-category Контент
 *
 * @param {object} props
 * @param {string} props.title - Заголовок секции
 * @param {string} props.eyebrow - Надпись над заголовком
 * @param {{title: string, items: {name: string, price: string, note: string}[]}[]} props.categories - Направления
 *
 * @kroy title widget=textarea
 * @kroy eyebrow widget=input
 * @kroy categories.title label=Название
 * @kroy categories.items label=Услуги
 * @kroy categories.items.name label=Услуга
 * @kroy categories.items.price label=Цена
 * @kroy categories.items.note label=Примечание
 */
export default function prepareServices({ props }) {
    const { title = '', eyebrow = '', categories = [] } = props;
    return {
        title, eyebrow,
        categories: Array.isArray(categories)
            ? categories.map((category) => ({ ...category, items: Array.isArray(category?.items) ? category.items : [] }))
            : [],
    };
}
