import ProductCards from '../../components/site/ProductCards.jsx';
import styles from './category-products.module.css';

/**
 * @kroy-title Товары категории
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
export default function CategoryProducts({ title = '', categoryId = '', limit = 0, products = [] }) {
    const filtered = products.filter((product) => product.categoryId === categoryId).slice(0, Number(limit) > 0 ? Number(limit) : undefined);
    if (!filtered.length) return null;
    return <section className={styles.section}><div className={styles.inner}>{title && <h2>{title}</h2>}<ProductCards products={filtered} /></div></section>;
}
