import ProductCards from '../../components/site/ProductCards.jsx';
import styles from './product-selection.module.css';

/**
 * @kroy-title Подборка товаров
 * @kroy-category Каталог
 *
 * @param {object} props
 * @param {string} props.title - Заголовок секции
 * @param {string[]} props.productIds - Выбранные товары
 *
 * @kroy title widget=input
 * @kroy productIds widget=catalog-products
 */
export default function ProductSelection({ title = '', productIds = [], products = [] }) {
    const selected = productIds.map((id) => products.find((product) => product.id === id)).filter(Boolean);
    if (!selected.length) return null;
    return <section className={styles.section}><div className={styles.inner}>{title && <h2>{title}</h2>}<ProductCards products={selected} /></div></section>;
}
