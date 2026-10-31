import ProductCards from '../../components/site/ProductCards.jsx';
import Section from '../../layout/Section.jsx';
import styles from './product-selection.module.css';

/**
 * @kroy-title Подборка товаров
 * @kroy-category Каталог
 * @kroy-contract products
 */
export default function ProductSelection({ data }) {
    const { title, products } = data;
    if (!products.length) return null;
    return <Section className={styles.section}><div className={styles.inner}>{title && <h2>{title}</h2>}<ProductCards products={products} /></div></Section>;
}
