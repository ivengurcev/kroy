import { useEffect, useRef, useState } from 'react';
import { paymentIsAvailable, createPaymentStarter } from '../payments/client.mjs';
import styles from './ProductCards.module.css';

export function ProductCard({ product, paymentEnabled }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const start = useRef(null);
    if (!start.current) start.current = createPaymentStarter(product.id, {
        onLoading: setLoading, onError: setError, navigate: (url) => window.location.assign(url),
    });
    return <article className={styles.card}>
        {product.mediaId && <img className={styles.image} src={`/api/media/${product.mediaId}`} alt="" />}
        <div className={styles.body}><h3>{product.name}</h3>{product.description && <p>{product.description}</p>}<div className={styles.footer}>
            <strong>{product.price} ₽</strong>
            {paymentEnabled && Number(product.price) > 0 && <button className={styles.buy} type="button" disabled={loading} onClick={start.current}>
                {loading ? 'Переход к оплате…' : 'Купить'}
            </button>}
        </div>{error && <p className={styles.error} role="alert">{error}</p>}</div>
    </article>;
}

export default function ProductCards({ products = [] }) {
    const [paymentEnabled, setPaymentEnabled] = useState(false);
    const hasProducts = products.length > 0;
    useEffect(() => {
        if (!hasProducts) { setPaymentEnabled(false); return undefined; }
        const controller = new AbortController();
        paymentIsAvailable(controller.signal)
            .then((enabled) => { if (!controller.signal.aborted) setPaymentEnabled(enabled); })
            .catch(() => { if (!controller.signal.aborted) setPaymentEnabled(false); });
        return () => controller.abort();
    }, [hasProducts]);
    if (!hasProducts) return null;
    return <div className={styles.grid}>{products.map((product) => <ProductCard product={product} paymentEnabled={paymentEnabled} key={product.id} />)}</div>;
}
