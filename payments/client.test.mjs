import assert from 'node:assert/strict';
import test from 'node:test';
import { paymentIsAvailable, createPaymentStarter } from './client.mjs';

const productId = '11111111-1111-4111-8111-111111111111';
test('availability fetch returns only the current public readiness flag and fails closed', async (t) => {
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        assert.equal(url, '/api/payments/status');
        assert.equal(options.cache, 'no-store');
        return Response.json({ enabled: true });
    });
    assert.equal(await paymentIsAvailable(), true);
    t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 500 }));
    assert.equal(await paymentIsAvailable(), false);
});

test('click flow sends only the product ID, reports loading, blocks a repeated click, then navigates to Prodamus', async (t) => {
    let finish;
    let calls = 0;
    const states = [];
    const errors = [];
    const navigations = [];
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        calls += 1;
        assert.equal(url, '/api/payments/start');
        assert.equal(options.method, 'POST');
        assert.deepEqual(JSON.parse(options.body), { productId });
        return new Promise((resolve) => { finish = resolve; });
    });
    const start = createPaymentStarter(productId, { onLoading: (value) => states.push(value), onError: (value) => errors.push(value), navigate: (url) => navigations.push(url) });
    const request = start();
    await start();
    assert.equal(calls, 1);
    assert.deepEqual(states, [true]);
    finish(Response.json({ url: 'https://payform.ru/link/' }));
    await request;
    assert.deepEqual(states, [true, false]);
    assert.deepEqual(navigations, ['https://payform.ru/link/']);
    assert.deepEqual(errors, ['']);
});

test('failed payment keeps the customer on the page, shows an error and allows retry', async (t) => {
    const errors = [];
    let calls = 0;
    t.mock.method(globalThis, 'fetch', async () => { calls += 1; return Response.json({ error: 'Оплата временно недоступна.' }, { status: 503 }); });
    const start = createPaymentStarter(productId, { onLoading() {}, onError: (value) => errors.push(value), navigate() { assert.fail('Do not navigate on failure'); } });
    await start();
    await start();
    assert.equal(calls, 2);
    assert.equal(errors.at(-1), 'Оплата временно недоступна.');
});
