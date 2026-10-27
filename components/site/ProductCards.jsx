import styles from './ProductCards.module.css';

export default function ProductCards({ products = [] }) {
    if (!products.length) return null;
    return <div className={styles.grid}>{products.map((product) => <article className={styles.card} key={product.id}>
        {product.mediaId && <img className={styles.image} src={`/api/media/${product.mediaId}`} alt="" />}
        <div className={styles.body}><h3>{product.name}</h3>{product.description && <p>{product.description}</p>}<div className={styles.footer}><strong>{product.price} ₽</strong>{product.paymentUrl && <a href={product.paymentUrl} target="_blank" rel="noopener noreferrer">Купить</a>}</div></div>
    </article>)}</div>;
}
