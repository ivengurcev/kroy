/**
 * @kroy-title Подборка товаров
 * @kroy-contract products
 * @kroy-default-widget @kroy/product-selection
 * @kroy-category Каталог
 *
 * @param {object} props
 * @param {string} props.title - Заголовок секции
 * @param {string[]} props.productIds - Выбранные товары
 *
 * @kroy title widget=input
 * @kroy productIds widget=catalog-products
 */
export default function prepareProductSelection({ props, catalog }) {
    const { title = '', productIds = [] } = props;
    const products = productIds.map((id) => catalog?.products.find((product) => product.id === id))
        .filter((product) => product?.status === 'published');
    return { title, products };
}
