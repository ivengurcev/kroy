/**
 * @kroy-title Товары категории
 * @kroy-contract products
 * @kroy-default-widget @kroy/category-products
 * @kroy-category Каталог
 *
 * @param {object} props
 * @param {string} props.title - Заголовок секции
 * @param {string} props.categoryId - Категория
 * @param {number} props.limit - Максимальное количество товаров
 *
 * @kroy title widget=input
 * @kroy categoryId widget=catalog-category
 * @kroy limit widget=number
 */
export default function prepareCategoryProducts({ props, catalog }) {
    const { title = '', categoryId = '', limit = 0 } = props;
    const products = (catalog?.products ?? [])
        .filter((product) => product.status === 'published')
        .filter((product) => categoryId === '__all__'
            || categoryId === '__uncategorized__' && !product.categoryId
            || product.categoryId === categoryId)
        .slice(0, Number(limit) > 0 ? Number(limit) : undefined);
    return { title, products };
}
