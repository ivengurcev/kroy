import assert from 'node:assert/strict';
import test from 'node:test';
import { pool } from '../db/client.mjs';
import { getPaymentStatus, postPaymentStart } from './checkout.mjs';

const productId = '11111111-1111-4111-8111-111111111111';
const product = { id: productId, name: 'Database position', price: '987.65', type: 'service', site_id: 'site-a', status: 'published' };
const integration = { provider: 'prodamus', settings: { payformDomain: 'example.payform.ru', secretKey: 'PRIVATE_MERCHANT_KEY' }, is_active: true };
function context(body = { productId }, hostname = 'a.localhost') {
    return { req: { header: () => hostname, async json() { return body; } }, json(value, status = 200, headers) { return { value, status, headers }; } };
}
function fixture(t, { item = product, active = integration, sys = 'PRIVATE_PLATFORM_SYS' } = {}) {
    const previous = process.env.PRODAMUS_SYS;
    if (sys === undefined || sys === null) delete process.env.PRODAMUS_SYS;
    else process.env.PRODAMUS_SYS = sys;
    t.after(() => { if (previous === undefined) delete process.env.PRODAMUS_SYS; else process.env.PRODAMUS_SYS = previous; });
    t.mock.method(pool, 'query', async (sql, values) => {
        if (sql.includes('FROM sites s')) return { rows: [{ id: values[0] === 'a.localhost' ? 'site-a' : 'site-b' }] };
        if (sql.includes('FROM products')) {
            assert.match(sql, /WHERE site_id = \$1 AND id = \$2 AND status = 'published'/);
            return { rows: item && item.site_id === values[0] && item.id === values[1] && item.status === 'published' ? [item] : [] };
        }
        assert.match(sql, /FROM site_payment_integrations WHERE site_id = \$1 AND is_active/);
        return { rows: active ? [active] : [] };
    });
}

test('pays a published current-site position using only database name, price, id and service/goods type', async (t) => {
    for (const type of ['service', 'goods']) {
        fixture(t, { item: { ...product, type } });
        t.mock.method(globalThis, 'fetch', async (url, options) => {
            const form = new URLSearchParams(options.body);
            assert.equal(form.get('products[0][name]'), 'Database position');
            assert.equal(form.get('products[0][price]'), '987.65');
            assert.equal(form.get('products[0][type]'), type);
            assert.equal(form.get('products[0][sku]'), productId);
            return new Response('https://payform.ru/valid/');
        });
        assert.equal((await getPaymentStatus(context())).value.enabled, true);
        const response = await postPaymentStart(context());
        assert.equal(response.status, 200);
        assert.deepEqual(response.value, { url: 'https://payform.ru/valid/' });
        assert.equal(response.headers['Cache-Control'], 'no-store');
        assert.doesNotMatch(JSON.stringify(response), /PRIVATE_|signature/);
    }
});

test('refuses unavailable configurations without active provider, secret or platform sys', async (t) => {
    for (const options of [
        { active: null }, { active: { ...integration, settings: { payformDomain: 'example.payform.ru' } } },
        { sys: '' }, { sys: null }, { active: { ...integration, provider: 'unknown' } },
        { active: { ...integration, settings: { ...integration.settings, payformDomain: '127.0.0.1' } } },
    ]) {
        fixture(t, options);
        t.mock.method(globalThis, 'fetch', () => { assert.fail('Unavailable checkout must not call Prodamus'); });
        assert.equal((await getPaymentStatus(context())).value.enabled, false);
        assert.equal((await postPaymentStart(context())).status, 503);
    }
});

test('hidden, missing and other-site products cannot be paid and zero/invalid prices are rejected', async (t) => {
    for (const [item, host, status] of [
        [{ ...product, status: 'hidden' }, 'a.localhost', 404], [null, 'a.localhost', 404],
        [product, 'b.localhost', 404], [{ ...product, price: '0.00' }, 'a.localhost', 400],
        [{ ...product, price: 'NaN' }, 'a.localhost', 400],
    ]) {
        fixture(t, { item });
        t.mock.method(globalThis, 'fetch', () => { assert.fail('Invalid product must not reach Prodamus'); });
        assert.equal((await postPaymentStart(context({ productId }, host))).status, status);
    }
});

test('rejects price/name/type/domain overrides and malformed requests before database access', async (t) => {
    t.mock.method(pool, 'query', () => { assert.fail('Invalid request must not query database'); });
    for (const key of ['price', 'name', 'type', 'payformDomain', 'quantity', 'secretKey', 'sys']) {
        assert.equal((await postPaymentStart(context({ productId, [key]: 'tampered' }))).status, 400);
    }
    for (const body of [{}, [], { productId: 'not-an-id' }]) assert.equal((await postPaymentStart(context(body))).status, 400);
});

test('provider and internal failures never expose secrets, signatures or upstream details', async (t) => {
    fixture(t);
    t.mock.method(globalThis, 'fetch', async () => new Response('PRIVATE_UPSTREAM_DETAIL', { status: 500 }));
    const failed = await postPaymentStart(context());
    assert.equal(failed.status, 502);
    assert.doesNotMatch(JSON.stringify(failed), /PRIVATE_|signature/);
    t.mock.method(pool, 'query', async () => { throw new Error('PRIVATE_DATABASE_DETAIL'); });
    t.mock.method(console, 'error', () => {});
    assert.equal((await postPaymentStart(context())).status, 500);
    assert.equal((await getPaymentStatus(context())).status, 500);
});
