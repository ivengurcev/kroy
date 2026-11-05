import { randomBytes } from 'node:crypto';
import { pool } from './client.mjs';
import PaymentError from '../server/payments/paymentError.mjs';
import { getProductForPayment } from './catalog.mjs';

const ITEM_QUERY = `SELECT id, product_id AS "productId", name, type, unit_price AS "unitPrice", quantity
    FROM order_items WHERE order_id = $1 ORDER BY sort_order, id`;
const ORDER_COLUMNS = `id, items_total AS total, currency, payment_status AS "paymentStatus",
    fulfillment_status AS "fulfillmentStatus", customer_phone AS "customerPhone", customer_email AS "customerEmail",
    customer_extra AS "customerExtra", is_test AS "isTest", created_at AS "createdAt", paid_at AS "paidAt", completed_at AS "completedAt"`;

export async function createOrder(siteId, productId, integration, origin) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const product = await getProductForPayment(siteId, productId, client);
        if (!product) throw new PaymentError('Позиция недоступна для оплаты.', 404);
        if (typeof product.price !== 'string' || !/^\d{1,10}\.\d{2}$/.test(product.price) || /^0+\.00$/.test(product.price)
            || !['service', 'goods'].includes(product.type) || !product.name?.trim()) throw new PaymentError('Позиция недоступна для оплаты.', 400);
        const { rows: [order] } = await client.query(`INSERT INTO orders (site_id, public_token, items_total, is_test, site_origin)
            VALUES ($1, $2, $3, $4, $5) RETURNING id, public_token AS token`,
        [siteId, randomBytes(32).toString('hex'), product.price, integration.settings.testMode === true, origin]);
        await client.query(`INSERT INTO order_items (order_id, product_id, name, type, unit_price, quantity)
            VALUES ($1, $2, $3, $4, $5, 1)`, [order.id, product.id, product.name, product.type, product.price]);
        await client.query(`INSERT INTO payments (site_id, order_id, provider, merchant_domain, amount, currency, is_test)
            VALUES ($1, $2, $3, $4, $5, 'RUB', $6)`,
        [siteId, order.id, integration.provider, integration.settings.payformDomain, product.price, integration.settings.testMode === true]);
        await client.query('COMMIT');
        return { ...order, product };
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
    } finally { client.release(); }
}

export async function listOrders(siteId, status, offset = 0) {
    const { rows } = await pool.query(`SELECT ${ORDER_COLUMNS},
        (SELECT name FROM order_items WHERE order_id = orders.id ORDER BY sort_order, id LIMIT 1) AS name
        FROM orders WHERE site_id = $1 AND ($2::text IS NULL
            OR ($2 = 'pending' AND payment_status = 'pending')
            OR ($2 = 'paid' AND payment_status = 'paid' AND fulfillment_status = 'pending')
            OR ($2 = 'completed' AND fulfillment_status = 'completed'))
        ORDER BY created_at DESC, id DESC LIMIT 51 OFFSET $3`, [siteId, status || null, offset]);
    return { orders: rows.slice(0, 50), hasMore: rows.length > 50 };
}

export async function getOrder(siteId, orderId) {
    const { rows: [order] } = await pool.query(`SELECT ${ORDER_COLUMNS} FROM orders WHERE site_id = $1 AND id = $2`, [siteId, orderId]);
    if (!order) return null;
    order.items = (await pool.query(ITEM_QUERY, [orderId])).rows;
    order.payments = (await pool.query(`SELECT provider, external_id AS "externalId", status, provider_status AS "providerStatus",
        amount, currency, created_at AS "createdAt", confirmed_at AS "confirmedAt" FROM payments
        WHERE site_id = $1 AND order_id = $2 ORDER BY created_at`, [siteId, orderId])).rows;
    return order;
}

export async function completeOrder(siteId, orderId) {
    const { rowCount } = await pool.query(`UPDATE orders SET fulfillment_status = 'completed', completed_at = COALESCE(completed_at, now())
        WHERE site_id = $1 AND id = $2 AND payment_status = 'paid'`, [siteId, orderId]);
    return rowCount > 0;
}

export async function getPublicOrder(siteId, token) {
    const { rows: [order] } = await pool.query(`SELECT id, payment_status AS "paymentStatus", fulfillment_status AS "fulfillmentStatus", is_test AS "isTest",
        (SELECT provider_status FROM payments WHERE payments.order_id = orders.id AND payments.site_id = orders.site_id ORDER BY created_at DESC LIMIT 1) AS "providerStatus"
        FROM orders WHERE site_id = $1 AND public_token = $2`, [siteId, token]);
    return order ?? null;
}

export async function getOrderNotificationSettings(siteId) {
    const { rows: [row] } = await pool.query(`SELECT order_notification_email AS email,
        (SELECT CASE WHEN count(*) = 1 THEN min(u.email) END FROM site_memberships sm
            JOIN users u ON u.id = sm.user_id WHERE sm.site_id = sites.id AND u.status = 'active' AND sm.role = 'admin') AS "defaultEmail"
        FROM sites WHERE id = $1`, [siteId]);
    return row;
}

export async function saveOrderNotificationSettings(siteId, email) {
    await pool.query('UPDATE sites SET order_notification_email = $2 WHERE id = $1', [siteId, email || null]);
}

export async function applyProdamusPayment(siteId, event) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // Serialize deliveries and fulfillment changes on the same order.
        const { rows: [order] } = await client.query('SELECT * FROM orders WHERE site_id = $1 AND id = $2 FOR UPDATE', [siteId, event.orderId]);
        const { rows: [payment] } = await client.query(`SELECT * FROM payments
            WHERE site_id = $1 AND order_id = $2 AND provider = 'prodamus' FOR UPDATE`, [siteId, event.orderId]);
        if (!order || !payment) throw new PaymentError('Заказ не найден.', 404);
        if (payment.merchant_domain !== event.domain || order.items_total !== event.amount || payment.amount !== event.amount
            || order.currency !== event.currency || payment.currency !== event.currency
            || order.is_test !== event.isTest || payment.is_test !== event.isTest
            || payment.status === 'succeeded' && event.status === 'success' && payment.external_id !== event.externalId) {
            throw new PaymentError('Уведомление не соответствует заказу.', 400);
        }
        if (payment.status !== 'succeeded') {
            const success = event.status === 'success';
            await client.query(`UPDATE payments SET external_id = CASE WHEN $4 = 'succeeded' THEN $3 ELSE NULL END, status = $4, provider_status = $5,
                confirmed_at = CASE WHEN $4 = 'succeeded' THEN $6::timestamptz ELSE NULL END
                WHERE site_id = $1 AND id = $2`, [siteId, payment.id, event.externalId, success ? 'succeeded' : 'failed', event.status, event.paidAt]);
            if (success && order.payment_status !== 'paid') {
                await client.query(`UPDATE orders SET payment_status = 'paid', paid_at = $3, customer_phone = $4,
                    customer_email = $5, customer_extra = $6 WHERE site_id = $1 AND id = $2`,
                [siteId, order.id, event.paidAt, event.phone, event.email, event.extra]);
                const { rows: [site] } = await client.query(`SELECT name, order_notification_email FROM sites WHERE id = $1`, [siteId]);
                const { rows: contacts } = await client.query(`SELECT u.email FROM site_memberships sm JOIN users u ON u.id = sm.user_id
                    WHERE sm.site_id = $1 AND sm.role = 'admin' AND u.status = 'active'`, [siteId]);
                const items = (await client.query(ITEM_QUERY, [order.id])).rows;
                const payload = {
                    to: site.order_notification_email || (contacts.length === 1 ? contacts[0].email : null),
                    siteName: site.name, orderId: order.id, items, total: order.items_total, currency: order.currency,
                    paidAt: event.paidAt, customerPhone: event.phone, customerEmail: event.email, isTest: order.is_test,
                    adminUrl: `${order.site_origin}/admin/orders?order=${order.id}`,
                };
                await client.query(`INSERT INTO order_notifications (order_id, event, payload)
                    VALUES ($1, 'order.paid', $2::jsonb) ON CONFLICT (order_id, event) DO NOTHING`, [order.id, JSON.stringify(payload)]);
            }
        }
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        if (error.code === '23505') throw new PaymentError('Платёж уже связан с другим заказом.', 409);
        throw error;
    } finally { client.release(); }
}
