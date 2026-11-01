import assert from 'node:assert/strict';
import test from 'node:test';
import { signProdamusRequest, createProdamusPaymentLink } from './prodamus.mjs';

const product = { id: '11111111-1111-4111-8111-111111111111', name: 'Услуга / товар', price: '123.45', type: 'service' };
const settings = { payformDomain: 'example.payform.ru', secretKey: 'test-merchant-secret' };

test('signature matches an independent HMAC vector with recursive key sorting, string values, Unicode and escaped slash', () => {
    const data = { sys: 'oysite-test', products: [{ type: 'service', sku: product.id, quantity: 1, price: product.price, name: product.name }], do: 'link', currency: 'rub' };
    const snapshot = JSON.stringify(data);
    assert.equal(signProdamusRequest(data, settings.secretKey), '208212317bbb0fac8430d33fa5432c77952870c863a1293376e4c194c178732d');
    assert.equal(JSON.stringify(data), snapshot);
});

test('posts exactly one signed position as documented form fields and returns a validated short link', async (t) => {
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        assert.equal(url, 'https://example.payform.ru/');
        assert.equal(options.method, 'POST');
        assert.equal(options.redirect, 'error');
        assert.ok(options.signal instanceof AbortSignal);
        assert.equal(options.headers['Content-Type'], 'application/x-www-form-urlencoded');
        const body = new URLSearchParams(options.body);
        assert.deepEqual(Object.fromEntries(body), {
            do: 'link', sys: 'oysite-test', currency: 'rub',
            'products[0][name]': product.name, 'products[0][price]': '123.45',
            'products[0][quantity]': '1', 'products[0][sku]': product.id, 'products[0][type]': 'service',
            signature: '208212317bbb0fac8430d33fa5432c77952870c863a1293376e4c194c178732d',
        });
        assert.equal(body.has('customer_email'), false);
        assert.equal(body.has('customer_phone'), false);
        assert.equal(String(options.body).includes(settings.secretKey), false);
        return new Response('https://payform.ru/Ab12/\n');
    });
    assert.equal(await createProdamusPaymentLink(product, settings, 'oysite-test'), 'https://payform.ru/Ab12/');
});

test('rejects unsafe request destinations before HTTP and refuses redirects, invalid links, errors and oversized responses', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => { assert.fail('Unsafe destination must not be requested'); });
    await assert.rejects(createProdamusPaymentLink(product, { ...settings, payformDomain: '127.0.0.1' }, 'sys'));
    for (const response of [
        new Response('', { status: 302, headers: { Location: 'http://127.0.0.1/' } }),
        new Response('PRIVATE_INTERNAL_DETAIL', { status: 500 }),
        new Response('https://evil.com/pay'), new Response('not a link'), new Response('x'.repeat(5000)),
        new Response('https://payform.ru/pay?signature=PRIVATE_SIGNATURE'),
        new Response(`https://payform.ru/${settings.secretKey}/`),
    ]) {
        t.mock.method(globalThis, 'fetch', async () => response);
        await assert.rejects(createProdamusPaymentLink(product, settings, 'sys'), (error) => {
            assert.equal(error.status, 502);
            assert.doesNotMatch(error.message, /PRIVATE_|test-merchant-secret/);
            return true;
        });
    }
});

test('timeout and connection failures produce safe errors without upstream details', async (t) => {
    for (const [name, status] of [['TimeoutError', 504], ['AbortError', 504], ['TypeError', 502]]) {
        t.mock.method(globalThis, 'fetch', async () => { const error = new Error('PRIVATE_SENTINEL'); error.name = name; throw error; });
        await assert.rejects(createProdamusPaymentLink(product, settings, 'sys'), (error) => error.status === status && !error.message.includes('PRIVATE_SENTINEL'));
    }
});

test('does not return a request signature hidden in percent-encoded payment URL data', async (t) => {
    const signature = '208212317bbb0fac8430d33fa5432c77952870c863a1293376e4c194c178732d';
    const encoded = [...signature].map((character) => `%${character.charCodeAt(0).toString(16)}`).join('');
    t.mock.method(globalThis, 'fetch', async () => new Response(`https://payform.ru/payment?token=${encoded}`));
    await assert.rejects(createProdamusPaymentLink(product, settings, 'oysite-test'), (error) => error.status === 502);
});
