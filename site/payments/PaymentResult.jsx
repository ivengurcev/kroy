import { useEffect, useState } from 'react';
import styles from './PaymentResult.module.css';

export default function PaymentResult() {
    const [token, setToken] = useState(null);
    const [order, setOrder] = useState(null);
    const [error, setError] = useState('');
    const [revision, setRevision] = useState(0);
    useEffect(() => {
        const value = new URLSearchParams(window.location.search).get('oysite_order');
        if (value && /^[a-f0-9]{64}$/.test(value)) setToken(value);
    }, []);
    useEffect(() => {
        if (!token) return undefined;
        const controller = new AbortController();
        let timer;
        let attempts = 0;
        async function refresh() {
            try {
                const response = await fetch(`/api/payments/orders/${token}`, { cache: 'no-store', signal: controller.signal });
                if (!response.ok) throw new Error('Не удалось получить состояние заказа.');
                const result = await response.json();
                if (controller.signal.aborted) return;
                setOrder(result); setError('');
                if (result.paymentStatus !== 'paid' && !['order_canceled', 'order_denied'].includes(result.providerStatus) && ++attempts < 20) timer = setTimeout(refresh, 3000);
            } catch (cause) { if (cause.name !== 'AbortError') setError('Не удалось проверить оплату. Попробуйте обновить статус позже.'); }
        }
        refresh();
        return () => { controller.abort(); clearTimeout(timer); };
    }, [token, revision]);

    if (!token) return null;
    return <section className={styles.result} aria-label="Состояние заказа" role="status">
        <h2>{order?.isTest ? 'Тестовый заказ' : 'Ваш заказ'}</h2>
        {order && <p>Номер: {order.id}</p>}
        <p>{error || (order?.paymentStatus === 'paid'
            ? order.fulfillmentStatus === 'completed' ? 'Заказ оплачен и выполнен.' : 'Оплата подтверждена. Владелец сайта получил ваш заказ.'
            : order?.providerStatus === 'order_canceled' ? 'Оплата отменена. Заказ не оплачен.'
                : order?.providerStatus === 'order_denied' ? 'Платёж отклонён банком. Заказ не оплачен.'
                    : 'Ожидаем подтверждение оплаты от Prodamus. Если вы уже оплатили, статус обновится после получения подтверждения.')}</p>
        {order?.paymentStatus !== 'paid' && <button type="button" onClick={() => setRevision((value) => value + 1)}>Обновить статус</button>}
    </section>;
}
