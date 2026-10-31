import assert from 'node:assert/strict';
import test from 'node:test';
import { pool } from './client.mjs';
import { getCatalog, normalizeCatalog, setCatalog } from './catalog.mjs';
import { patchSiteCatalog } from '../api/siteCatalog.mjs';

const productId = '11111111-1111-4111-8111-111111111111';

test('catalog defaults to service and accepts only service or goods', () => {
    assert.equal(normalizeCatalog({ products: [{ name: 'Position' }] }).products[0].type, 'service');
    for (const type of ['service', 'goods']) {
        assert.equal(normalizeCatalog({ products: [{ name: 'Position', type }] }).products[0].type, type);
    }
    for (const type of ['', null, 'other', 1]) {
        assert.throws(() => normalizeCatalog({ products: [{ name: 'Position', type }] }), /Тип позиции/);
    }
});

test('saves and loads the product type through site-scoped catalog SQL', async (t) => {
    let products = [];
    t.mock.method(pool, 'connect', async () => ({ async query(sql, values) {
        if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return {};
        if (sql.startsWith('DELETE')) { assert.equal(values[0], 'site-id'); return {}; }
        assert.match(sql, /INSERT INTO products/);
        assert.match(sql, /price, type, sort_order, status/);
        assert.equal(values[1], 'site-id');
        products = [{ id: values[0], category_id: values[2], name: values[3], description: values[4], media_id: values[5], price: values[6], type: values[7], sort_order: values[8], status: values[9] }];
        return { rows: [{ id: productId }] };
    }, release() {} }));
    t.mock.method(pool, 'query', async (sql, values) => {
        assert.equal(values[0], 'site-id');
        if (sql.includes('FROM product_categories')) return { rows: [] };
        assert.match(sql, /price, type, sort_order, status/);
        return { rows: products };
    });
    for (const type of ['goods', 'service']) {
        const saved = await setCatalog('site-id', { categories: [], products: [{ id: productId, name: 'Product', price: '12.30', type }] });
        assert.equal(saved.products[0].type, type);
        assert.equal((await getCatalog('site-id')).products[0].type, type);
        assert.deepEqual(Object.keys(saved.products[0]).sort(), ['categoryId', 'description', 'id', 'mediaId', 'name', 'price', 'sortOrder', 'status', 'type']);
    }
});

test('catalog API rejects invalid position types as 400 before any write', async (t) => {
    t.mock.method(pool, 'query', async () => ({ rows: [{ id: 'site-id' }] }));
    t.mock.method(pool, 'connect', () => { assert.fail('Invalid type must not be saved'); });
    const response = await patchSiteCatalog({
        req: { header: () => 'site.localhost', async json() { return { products: [{ name: 'Product', type: 'invalid' }] }; } },
        json(value, status = 200) { return { value, status }; },
    });
    assert.equal(response.status, 400);
});
