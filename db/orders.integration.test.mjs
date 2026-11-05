import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { randomUUID } from 'node:crypto';
import { pool } from './client.mjs';
import { createOrder, completeOrder, getOrder, getPublicOrder, listOrders, getOrderNotificationSettings, saveOrderNotificationSettings } from './orders.mjs';
import { savePaymentIntegration } from './sitePaymentIntegrations.mjs';
import { dispatchOrderNotifications, setOrderNotificationTransport } from '../server/notifications/orders.mjs';
import { postProdamusWebhook, getSiteOrder, postCompleteOrder, getPublicOrderStatus } from '../server/api/orders.mjs';
import { signProdamusRequest } from '../server/payments/prodamus.mjs';

after(() => pool.end());

test('orders: snapshot, tenant isolation, verified webhook, concurrent retries, fulfillment, notifications and test/live separation', async (t) => {
    if (process.env.RUN_PAYMENT_INTEGRATION_TESTS !== '1') return t.skip('Requires an explicitly isolated payment test database');
    assert.match(process.env.PAYMENT_TEST_DATABASE || '', /test/);
    assert.equal((await pool.query('SELECT current_database()')).rows[0].current_database, process.env.PAYMENT_TEST_DATABASE);
    const siteIds = [];
    const users = [];
    try {
        for (const label of ['a', 'b']) {
            const { rows: [site] } = await pool.query('INSERT INTO sites (slug, name) VALUES ($1, $2) RETURNING id', [`orders-test-${randomUUID()}`, `Test site ${label}`]);
            siteIds.push(site.id);
            await pool.query('INSERT INTO domains (site_id, hostname) VALUES ($1, $2)', [site.id, `${site.id}.example.test`]);
        }
        const [siteA, siteB] = siteIds;
        const { rows: [user] } = await pool.query(`INSERT INTO users (email, password_hash) VALUES ($1, 'test-only') RETURNING id`, [`${randomUUID()}@example.test`]);
        users.push(user.id);
        await pool.query(`INSERT INTO site_memberships (site_id, user_id, role) VALUES ($1, $2, 'admin')`, [siteA, user.id]);
        assert.match((await getOrderNotificationSettings(siteA)).defaultEmail, /example.test/);
        await saveOrderNotificationSettings(siteA, 'explicit@example.test');
        await pool.query('UPDATE users SET email = $2 WHERE id = $1', [user.id, 'updated@example.test']);
        assert.equal((await getOrderNotificationSettings(siteA)).email, 'explicit@example.test');

        const settings = { payformDomain: 'a.payform.ru', secretKey: 'SITE_A_TEST_SECRET' };
        await savePaymentIntegration(siteA, 'prodamus', settings);
        await savePaymentIntegration(siteB, 'prodamus', { payformDomain: 'b.payform.ru', secretKey: 'SITE_B_TEST_SECRET' });
        const stored = (await pool.query('SELECT settings FROM site_payment_integrations WHERE site_id = $1', [siteA])).rows[0].settings;
        assert.match(stored.secretKey, /^encrypted:v1:/);
        assert.doesNotMatch(JSON.stringify(stored), /SITE_A_TEST_SECRET/);
        const { rows: [product] } = await pool.query(`INSERT INTO products (site_id, name, price, type) VALUES ($1, 'Онлайн-консультация', 2000, 'service') RETURNING id`, [siteA]);
        const integration = { provider: 'prodamus', settings };
        const order = await createOrder(siteA, product.id, integration, `https://${siteA}.example.test`);
        await pool.query(`UPDATE products SET name = 'Новое название', price = 3000 WHERE id = $1`, [product.id]);
        assert.equal((await getOrder(siteA, order.id)).items[0].name, 'Онлайн-консультация');
        assert.equal((await getOrder(siteA, order.id)).total, '2000.00');
        assert.equal(await getOrder(siteB, order.id), null);
        assert.equal(await getPublicOrder(siteB, order.token), null);
        assert.equal(await completeOrder(siteA, order.id), false);
        await assert.rejects(createOrder(siteB, product.id, integration, 'https://b.example.test'));

        const data = { order_num: order.id, order_id: '80001', domain: 'a.payform.ru', sum: '2000.00',
            date: '2026-11-05T12:00:00+03:00', payment_status: 'success', customer_phone: '+79991234567', customer_email: 'buyer@example.test', customer_extra: 'Примечание',
            products: [{ name: 'Онлайн-консультация', price: '2000.00', quantity: '1', sum: '2000.00' }] };
        function formEntries(body) {
            return Object.entries(body).flatMap(([key, value]) => key === 'products'
                ? value.flatMap((product, index) => Object.entries(product).map(([field, fieldValue]) => [`products[${index}][${field}]`, fieldValue]))
                : [[key, value]]);
        }
        function context(siteId, body, signature, params = {}) {
            const encoded = new URLSearchParams(formEntries(body));
            const request = new Request(`https://${siteId}.example.test/api/payments/prodamus/webhook`, {
                method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Sign: signature || '' }, body: encoded,
            });
            return { req: { raw: request, header: (name) => name.toLowerCase() === 'host' ? `${siteId}.example.test` : request.headers.get(name), param: (name) => params[name] },
                json: (value, status = 200) => ({ value, status }), text: (value, status = 200) => ({ value, status }) };
        }
        const signature = signProdamusRequest(data, settings.secretKey);
        assert.equal((await postProdamusWebhook(context(siteA, data, 'f'.repeat(64)))).status, 403);
        assert.equal((await postProdamusWebhook(context(siteB, data, signature))).status, 403);
        assert.equal((await getSiteOrder(context(siteB, {}, '', { id: order.id }))).status, 404);
        assert.equal((await postCompleteOrder(context(siteB, {}, '', { id: order.id }))).status, 409);
        assert.equal((await getPublicOrderStatus(context(siteB, {}, '', { token: order.token }))).status, 404);
        for (const change of [{ sum: '1999.99' }, { currency: 'usd' }, { order_num: randomUUID() }, { demo_mode: '1' }, { domain: 'b.payform.ru' }]) {
            const wrong = { ...data, ...change };
            assert.ok((await postProdamusWebhook(context(siteA, wrong, signProdamusRequest(wrong, settings.secretKey)))).status >= 400);
        }
        assert.equal((await getOrder(siteA, order.id)).paymentStatus, 'pending');
        const results = await Promise.all(Array.from({ length: 6 }, () => postProdamusWebhook(context(siteA, data, signature))));
        assert.ok(results.every((result) => result.status === 200));
        let saved = await getOrder(siteA, order.id);
        assert.equal(saved.paymentStatus, 'paid');
        assert.equal(saved.customerEmail, data.customer_email);
        assert.equal(saved.customerPhone, data.customer_phone);
        assert.equal(saved.customerExtra, data.customer_extra);
        assert.equal(saved.payments.length, 1);
        assert.equal(saved.payments[0].externalId, '80001');
        assert.equal(saved.payments[0].status, 'succeeded');
        await dispatchOrderNotifications(); // no transport is a normal operating mode
        assert.equal((await pool.query('SELECT count(*)::int AS count FROM order_notifications WHERE order_id = $1', [order.id])).rows[0].count, 1);
        assert.equal(await completeOrder(siteA, order.id), true);
        const completed = await getOrder(siteA, order.id);
        assert.equal(completed.fulfillmentStatus, 'completed');
        assert.deepEqual(completed.paidAt, saved.paidAt);
        assert.deepEqual(completed.payments, saved.payments);
        const denied = { ...data, payment_status: 'order_denied' };
        assert.equal((await postProdamusWebhook(context(siteA, denied, signProdamusRequest(denied, settings.secretKey)))).status, 200);
        assert.equal((await getOrder(siteA, order.id)).paymentStatus, 'paid');
        assert.equal((await listOrders(siteB)).orders.length, 0);
        assert.equal((await listOrders(siteA, 'completed')).orders.length, 1);
        assert.equal((await listOrders(siteA, 'pending')).orders.length, 0);
        const publicResult = await getPublicOrder(siteA, order.token);
        assert.doesNotMatch(JSON.stringify(publicResult), /buyer@|79991234567|Примечание/);

        let deliveries = 0;
        setOrderNotificationTransport(async () => { throw new Error('Test transport outage'); });
        await dispatchOrderNotifications();
        assert.equal((await getOrder(siteA, order.id)).paymentStatus, 'paid');
        setOrderNotificationTransport(async (message) => {
            deliveries += 1;
            assert.equal(message.to, 'explicit@example.test');
            assert.ok(message.idempotencyKey);
            assert.match(message.text, /Онлайн-консультация/);
            assert.match(message.text, /2000.00 RUB/);
            assert.match(message.text, /buyer@example.test/);
            assert.match(message.text, /admin\/orders\?order=/);
        });
        await dispatchOrderNotifications();
        await dispatchOrderNotifications();
        assert.equal(deliveries, 1);
        setOrderNotificationTransport(null);

        const second = await createOrder(siteA, product.id, integration, 'https://a.example.test');
        const duplicate = { ...data, order_num: second.id, sum: '3000.00' };
        assert.equal((await postProdamusWebhook(context(siteA, duplicate, signProdamusRequest(duplicate, settings.secretKey)))).status, 409);
        assert.equal((await getOrder(siteA, second.id)).paymentStatus, 'pending');
        const canceled = { ...duplicate, order_id: '80002', payment_status: 'order_canceled' };
        assert.equal((await postProdamusWebhook(context(siteA, canceled, signProdamusRequest(canceled, settings.secretKey)))).status, 200);
        assert.equal((await getOrder(siteA, second.id)).payments[0].status, 'failed');
        assert.equal((await getOrder(siteA, second.id)).payments[0].externalId, null);
        const retrySuccess = { ...duplicate, order_id: '80003', payment_status: 'success' };
        assert.equal((await postProdamusWebhook(context(siteA, retrySuccess, signProdamusRequest(retrySuccess, settings.secretKey)))).status, 200);
        const lateFailure = { ...canceled, payment_status: 'order_denied' };
        assert.equal((await postProdamusWebhook(context(siteA, lateFailure, signProdamusRequest(lateFailure, settings.secretKey)))).status, 200);
        const retriedOrder = await getOrder(siteA, second.id);
        assert.equal(retriedOrder.paymentStatus, 'paid');
        assert.equal(retriedOrder.payments[0].externalId, '80003');
        assert.equal(retriedOrder.payments[0].status, 'succeeded');
        assert.equal((await pool.query("SELECT count(*)::int AS count FROM order_notifications WHERE order_id = $1", [second.id])).rows[0].count, 1);
        assert.equal(await completeOrder(siteA, second.id), false);
        const testOrder = await createOrder(siteA, product.id, { ...integration, settings: { ...settings, testMode: true } }, 'https://a.example.test');
        const demo = { ...duplicate, order_num: testOrder.id, order_id: '80003', _param_oysite_test: '1', demo_mode: '1' };
        assert.equal((await postProdamusWebhook(context(siteA, demo, signProdamusRequest(demo, `${settings.secretKey}demo`)))).status, 200);
        assert.equal((await getOrder(siteA, testOrder.id)).isTest, true);
        assert.equal((await getOrder(siteA, testOrder.id)).paymentStatus, 'paid');
        const { rows: [otherProduct] } = await pool.query(`INSERT INTO products (site_id, name, price, type) VALUES ($1, 'Другая услуга', 2000, 'service') RETURNING id`, [siteB]);
        const otherOrder = await createOrder(siteB, otherProduct.id, { provider: 'prodamus', settings: { payformDomain: 'b.payform.ru' } }, 'https://b.example.test');
        const otherData = { ...data, order_num: otherOrder.id, domain: 'b.payform.ru' };
        const otherSignature = signProdamusRequest(otherData, 'SITE_B_TEST_SECRET');
        assert.equal((await postProdamusWebhook(context(siteB, otherData, otherSignature))).status, 200);
        assert.equal((await getOrder(siteB, otherOrder.id)).paymentStatus, 'paid');
        assert.equal((await getOrder(siteB, otherOrder.id)).payments[0].externalId, '80001', 'Different merchant forms may reuse external IDs');
        const jsonContext = context(siteB, {}, otherSignature);
        jsonContext.req.raw = new Request('https://b.example.test/api/payments/prodamus/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json', Sign: otherSignature }, body: JSON.stringify(otherData) });
        jsonContext.req.header = (name) => name.toLowerCase() === 'host' ? `${siteB}.example.test` : jsonContext.req.raw.headers.get(name);
        assert.equal((await postProdamusWebhook(jsonContext)).status, 200);
        const multipartContext = context(siteB, {}, otherSignature);
        const form = new FormData();
        for (const [key, value] of formEntries(otherData)) form.set(key, value);
        multipartContext.req.raw = new Request('https://b.example.test/api/payments/prodamus/webhook', { method: 'POST', headers: { Sign: otherSignature }, body: form });
        multipartContext.req.header = (name) => name.toLowerCase() === 'host' ? `${siteB}.example.test` : multipartContext.req.raw.headers.get(name);
        assert.equal((await postProdamusWebhook(multipartContext)).status, 200);
    } finally {
        setOrderNotificationTransport(null);
        for (const id of siteIds) {
            await pool.query('DELETE FROM site_memberships WHERE site_id = $1', [id]);
            await pool.query('DELETE FROM domains WHERE site_id = $1', [id]);
            await pool.query('DELETE FROM sites WHERE id = $1', [id]);
        }
        for (const id of users) await pool.query('DELETE FROM users WHERE id = $1', [id]);
    }
});
