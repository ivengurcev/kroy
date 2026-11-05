import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeWebhook } from './webhook.mjs';
import { parseProdamusForm, signProdamusRequest, verifyProdamusSignature, createProdamusPaymentLink } from './prodamus.mjs';
import { encryptPaymentSecret, decryptPaymentSecret } from './secrets.mjs';

const settings = { payformDomain: 'merchant.payform.ru', secretKey: 'merchant-test-secret' };
const payload = { order_num: '11111111-1111-4111-8111-111111111111', order_id: '123456', domain: settings.payformDomain,
    sum: '2000.00', currency: 'rub', date: '2026-11-05T12:30:00+03:00', payment_status: 'success',
    customer_phone: '+79991234567', customer_email: 'buyer@example.org', customer_extra: 'Консультация',
    products: [{ name: 'Консультация', price: '2000.00', quantity: '1' }] };

test('official bracket-form reconstructs products and verifies the complete payload, including contacts and attempts', () => {
    const form = new URLSearchParams(Object.entries(payload).filter(([key]) => key !== 'products'));
    for (const [key, value] of Object.entries(payload.products[0])) form.set(`products[0][${key}]`, value);
    const data = parseProdamusForm(form.toString());
    assert.deepEqual(data, payload);
    const signature = signProdamusRequest(payload, settings.secretKey);
    const event = normalizeWebhook(data, settings, signature);
    assert.equal(event.orderId, payload.order_num);
    assert.equal(event.externalId, '123456');
    assert.equal(event.phone, payload.customer_phone);
    assert.equal(event.email, payload.customer_email);
    assert.equal(event.extra, payload.customer_extra);
    assert.equal(event.amount, '2000.00');
    assert.equal(event.currency, 'RUB');
    assert.equal(event.paidAt, '2026-11-05T09:30:00.000Z');
    assert.throws(() => normalizeWebhook({ ...data, customer_email: 'attacker@example.org' }, settings, signature), /подпись/);
    assert.throws(() => normalizeWebhook(data, { ...settings, secretKey: 'another-site-key' }, signature), /подпись/);
    assert.equal(verifyProdamusSignature(data, settings.secretKey, 'invalid'), false);
});

test('rejects duplicate form keys, prototype pollution and scalar/object collisions', () => {
    for (const form of ['sum=1&sum=2', '__proto__[polluted]=1', 'products=foo&products[0][price]=2', 'products[constructor][name]=bad']) {
        assert.throws(() => parseProdamusForm(form));
    }
    assert.equal({}.polluted, undefined);
});

test('valid signature does not bypass domain, currency, amount, order number or recurring-payment validation', () => {
    for (const change of [{ domain: 'other.payform.ru' }, { currency: 'usd' }, { currency: undefined }, { sum: '2000.001' },
        { sum: '-1' }, { order_num: 'unknown' }, { order_id: {} }, { payment_status: 'unknown' }, { subscription: { id: '1' } }, { date: 'invalid' }]) {
        const data = { ...payload, ...change };
        assert.throws(() => normalizeWebhook(data, settings, signProdamusRequest(data, settings.secretKey)));
    }
    for (const payment_status of ['order_denied', 'order_canceled']) {
        const data = { ...payload, payment_status };
        assert.equal(normalizeWebhook(data, settings, signProdamusRequest(data, settings.secretKey)).status, payment_status);
    }
});

test('demo suffix signature is accepted only for a marked test event, never a live order event', () => {
    const demoSignature = signProdamusRequest(payload, `${settings.secretKey}demo`);
    assert.throws(() => normalizeWebhook(payload, settings, demoSignature), /подпись/);
    const data = { ...payload, demo_mode: '1', _param_oysite_test: '1' };
    for (const key of [settings.secretKey, `${settings.secretKey}demo`]) {
        assert.equal(normalizeWebhook(data, settings, signProdamusRequest(data, key)).isTest, true);
    }
});

test('independent shops create a signed order link without sys or urlNotification and explicit test markers', async (t) => {
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        const form = new URLSearchParams(options.body);
        assert.equal(form.has('sys'), false);
        assert.equal(form.has('urlNotification'), false);
        assert.equal(form.get('order_id'), payload.order_num);
        assert.equal(form.get('products[0][type]'), 'service');
        assert.equal(form.get('demo_mode'), '1');
        assert.equal(form.get('_param_oysite_test'), '1');
        assert.equal(form.get('payments_limit'), '1');
        return new Response('https://payform.ru/test/');
    });
    assert.equal(await createProdamusPaymentLink({ id: 'product', name: 'Консультация', price: '2000.00', type: 'service' },
        { ...settings, testMode: true }, undefined, { id: payload.order_num, returnUrl: 'https://shop.example/?oysite_order=token' }), 'https://payform.ru/test/');
});

test('merchant secrets are authenticated encrypted, randomized, and unreadable with another encryption key', (t) => {
    const previous = process.env.PAYMENT_ENCRYPTION_KEY;
    t.after(() => { if (previous === undefined) delete process.env.PAYMENT_ENCRYPTION_KEY; else process.env.PAYMENT_ENCRYPTION_KEY = previous; });
    process.env.PAYMENT_ENCRYPTION_KEY = 'test-only-key-with-at-least-32-characters';
    const encrypted = encryptPaymentSecret('PRIVATE_MERCHANT_KEY');
    assert.doesNotMatch(encrypted, /PRIVATE_MERCHANT_KEY/);
    assert.notEqual(encrypted, encryptPaymentSecret('PRIVATE_MERCHANT_KEY'));
    assert.equal(decryptPaymentSecret(encrypted), 'PRIVATE_MERCHANT_KEY');
    process.env.PAYMENT_ENCRYPTION_KEY = 'another-test-key-with-at-least-32-characters';
    assert.throws(() => decryptPaymentSecret(encrypted));
});
