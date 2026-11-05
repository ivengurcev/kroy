import { pool } from '../../db/client.mjs';

let transport = null;

// The transport must honor idempotencyKey, including retries after process failure.
// No mail provider is selected implicitly. Unsent events stay in the transactional outbox.
export function setOrderNotificationTransport(send) { transport = send; }

export function orderEmail(payload) {
    return {
        to: payload.to,
        subject: `${payload.isTest ? '[Тест] ' : ''}Новый оплаченный заказ — ${payload.siteName}`,
        text: [payload.siteName, `Заказ: ${payload.orderId}`,
            ...payload.items.map((item) => `${item.name} × ${item.quantity}: ${item.unitPrice} ${payload.currency}`),
            `Сумма: ${payload.total} ${payload.currency}`, `Дата оплаты: ${payload.paidAt}`,
            `Телефон: ${payload.customerPhone || 'не указан'}`, `Email: ${payload.customerEmail || 'не указан'}`,
            payload.adminUrl].join('\n'),
    };
}

export async function dispatchOrderNotifications() {
    if (!transport) return;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { rows } = await client.query(`SELECT id, payload FROM order_notifications WHERE sent_at IS NULL
            AND payload->>'to' IS NOT NULL ORDER BY created_at LIMIT 20 FOR UPDATE SKIP LOCKED`);
        for (const row of rows) {
            await transport({ ...orderEmail(row.payload), idempotencyKey: row.id });
            await client.query('UPDATE order_notifications SET sent_at = now() WHERE id = $1', [row.id]);
        }
        await client.query('COMMIT');
    } catch {
        await client.query('ROLLBACK').catch(() => {});
        // A transport outage never rolls back a confirmed payment or exposes contacts in logs.
    } finally { client.release(); }
}
