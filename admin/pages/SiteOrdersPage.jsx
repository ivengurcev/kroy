import { useEffect, useState } from 'react';
import AdminPageShell from '../components/AdminPageShell.jsx';
import { AdminListToolbar, AdminListField, Pagination } from '../components/AdminList.jsx';
import listStyles from '../components/AdminList.module.css';
import Button from '../ui/Button.jsx';
import StatusBadge from '../ui/StatusBadge.jsx';
import Table from '../ui/Table.jsx';
import Modal from '../ui/Modal.jsx';
import styles from './SiteOrdersPage.module.css';

const date = (value) => value ? new Date(value).toLocaleString('ru-RU') : '—';
const money = (value, currency) => `${value} ${currency}`;
function OrderStatus({ order }) {
    const completed = order.fulfillmentStatus === 'completed';
    const paid = order.paymentStatus === 'paid';
    return <StatusBadge tone={paid ? 'success' : 'warning'}>{completed ? 'Выполнен' : paid ? 'Оплачен' : 'Ожидает оплаты'}</StatusBadge>;
}
async function read(response) {
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Не удалось загрузить заказы.');
    return data;
}

export default function SiteOrdersPage() {
    const [orders, setOrders] = useState([]);
    const [filter, setFilter] = useState('');
    const [offset, setOffset] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [status, setStatus] = useState('loading');
    const [order, setOrder] = useState(null);
    const [selected, setSelected] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [dialogError, setDialogError] = useState('');
    const [revision, setRevision] = useState(0);

    useEffect(() => {
        const controller = new AbortController();
        setStatus('loading'); setError('');
        fetch(`/api/site/orders?status=${filter}&offset=${offset}`, { signal: controller.signal, cache: 'no-store' }).then(read)
            .then((result) => { setOrders(result.orders); setHasMore(result.hasMore); setStatus('success'); })
            .catch((cause) => { if (cause.name !== 'AbortError') { setError(cause.message); setStatus('error'); } });
        return () => controller.abort();
    }, [filter, offset, revision]);

    useEffect(() => {
        const id = new URLSearchParams(window.location.search).get('order');
        if (id) setSelected(id);
    }, []);

    useEffect(() => {
        if (!selected) return undefined;
        const controller = new AbortController();
        setOrder(null); setDialogError('');
        fetch(`/api/site/orders/${encodeURIComponent(selected)}`, { signal: controller.signal, cache: 'no-store' }).then(read)
            .then(setOrder).catch((cause) => { if (cause.name !== 'AbortError') setDialogError(cause.message); });
        return () => controller.abort();
    }, [selected]);

    async function complete() {
        if (busy) return;
        setBusy(true); setDialogError('');
        try {
            const result = await read(await fetch(`/api/site/orders/${order.id}/complete`, { method: 'POST' }));
            setOrder(result); setRevision((value) => value + 1);
        } catch (cause) { setDialogError(cause.message); }
        finally { setBusy(false); }
    }

    return <AdminPageShell title="Заказы" list status={status} errorMessage={error}>
        <div className={styles.content}>
            <AdminListToolbar actions={<Button size="compact" onClick={() => setRevision((value) => value + 1)}>Обновить</Button>}>
                <AdminListField label="Статус заказа">
                    <select value={filter} onChange={(event) => { setFilter(event.target.value); setOffset(0); }}>
                        <option value="">Все заказы</option><option value="pending">Ожидает оплаты</option><option value="paid">Оплачен</option><option value="completed">Выполнен</option>
                    </select>
                </AdminListField>
            </AdminListToolbar>
                <Table className={listStyles.table} aria-label="Заказы текущего сайта">
                    <thead><tr><th>Дата</th><th>Заказ / услуга</th><th>Покупатель</th><th>Сумма</th><th>Статус</th></tr></thead>
                    <tbody>{orders.map((item) => <tr key={item.id} className={styles.orderRow} onClick={() => setSelected(item.id)}>
                        <td>{date(item.createdAt)}</td>
                        <td><button className={styles.orderLink} type="button" onClick={(event) => { event.stopPropagation(); setSelected(item.id); }}>{item.name}</button><small>№ {item.id}</small>{item.isTest && <StatusBadge tone="warning">Тестовый</StatusBadge>}</td>
                        <td>{item.customerEmail || 'Контакты пока неизвестны'}<small>{item.customerPhone}</small></td>
                        <td>{money(item.total, item.currency)}</td><td><OrderStatus order={item} /></td>
                    </tr>)}{!orders.length && <tr><td className={listStyles.state} colSpan="5">{filter ? 'По заданным условиям ничего не найдено.' : 'Заказов пока нет.'}</td></tr>}</tbody>
                </Table>
            <Pagination page={offset / 50} hasNext={hasMore} onChange={(page) => setOffset(page * 50)} />
        </div>
        {selected && <Modal title="Подробности заказа" busy={busy} onClose={() => setSelected(null)} actions={<>
            <Button disabled={busy} onClick={() => setSelected(null)}>Закрыть</Button>
            {order?.paymentStatus === 'paid' && order.fulfillmentStatus !== 'completed' && <Button variant="primary" disabled={busy} onClick={complete}>{busy ? 'Сохранение…' : 'Отметить выполненным'}</Button>}
        </>}>
            {!order && !dialogError && <p role="status">Загрузка…</p>}
            {order && <>
                <dl className={styles.details}>
                    <dt>Номер заказа</dt><dd>{order.id}</dd><dt>Создан</dt><dd>{date(order.createdAt)}</dd>
                    <dt>Статус</dt><dd><OrderStatus order={order} /> {order.isTest && <StatusBadge tone="warning">Тестовый заказ</StatusBadge>}</dd>
                    <dt>Оплата</dt><dd>{order.paymentStatus === 'paid' ? 'Подтверждена Prodamus' : 'Не подтверждена'}</dd>
                    <dt>Телефон</dt><dd>{order.customerPhone || 'Не указан'}</dd><dt>Email</dt><dd>{order.customerEmail || 'Не указан'}</dd>
                    <dt>Примечание</dt><dd>{order.customerExtra || '—'}</dd><dt>Оплачен</dt><dd>{date(order.paidAt)}</dd>
                    <dt>Выполнен</dt><dd>{date(order.completedAt)}</dd>
                </dl>
                <Table aria-label="Состав заказа"><thead><tr><th>Позиция</th><th>Цена</th><th>Количество</th></tr></thead>
                    <tbody>{order.items.map((item) => <tr key={item.id}><td>{item.name}</td><td>{money(item.unitPrice, order.currency)}</td><td>{item.quantity}</td></tr>)}</tbody>
                </Table>
                <p><strong>Итого: {money(order.total, order.currency)}</strong></p>
                {order.payments.map((payment, index) => <p key={index}>Prodamus: {payment.externalId || 'Ожидается платёж'}{payment.providerStatus === 'order_canceled' ? ' — отменён покупателем' : payment.providerStatus === 'order_denied' ? ' — отклонён банком' : ''}</p>)}
            </>}
            {dialogError && <p role="alert">{dialogError}</p>}
        </Modal>}
    </AdminPageShell>;
}
