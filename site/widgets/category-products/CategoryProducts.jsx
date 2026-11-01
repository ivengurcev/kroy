import ProductCards from '../../components/ProductCards.jsx';
import Section from '../../runtime/Section.jsx';
import styles from './category-products.module.css';

/**
 * @kroy-title Товары категории
 * @kroy-category Каталог
 * @kroy-contract products
 */
export default function CategoryProducts({ data }) {
    const { title, products } = data;
    if (!products.length) return null;
    return <Section className={styles.section}><div className={styles.inner}>{title && <h2>{title}</h2>}<ProductCards products={products} /></div></Section>;
}
