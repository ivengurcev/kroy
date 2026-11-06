import assert from 'node:assert/strict';
import test from 'node:test';
import { pool } from './client.mjs';
import { countUncategorizedProducts, deleteCatalogCategory, deleteCatalogProduct, getCatalog, listCatalogCategories, listCatalogProducts, normalizeCatalog, normalizeProduct, saveCatalogCategory, saveCatalogProduct, setCatalog } from './catalog.mjs';
import { getSiteCatalogProducts, patchSiteCatalog } from '../server/api/siteCatalog.mjs';

const productId = '11111111-1111-4111-8111-111111111111';
const categoryId = '22222222-2222-4222-8222-222222222222';

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

test('server-side product listing applies category, search, type, status, limit and offset and returns total', async (t) => {
    let calls = 0;
    t.mock.method(pool, 'query', async (sql, values) => {
        calls++;
        assert.match(sql, /site_id = \$1/);
        assert.match(sql, /category_id = \$2/);
        assert.match(sql, /ILIKE \$3/);
        assert.match(sql, /type = \$4/);
        assert.match(sql, /status = \$5/);
        if (sql.includes('count(*)')) {
            assert.deepEqual(values, ['site-a', 'category-a', '%lamp%', 'goods', 'published']);
            return { rows: [{ total: 61 }] };
        }
        assert.match(sql, /LIMIT \$6 OFFSET \$7/);
        assert.deepEqual(values, ['site-a', 'category-a', '%lamp%', 'goods', 'published', 10, 20]);
        return { rows: [{ id: productId, category_id: 'category-a', name: 'Lamp', description: '', media_id: null, price: '20.00', type: 'goods', sort_order: 0, status: 'published' }] };
    });
    const result = await listCatalogProducts('site-a', { categoryId: 'category-a', search: 'lamp', type: 'goods', status: 'published', limit: 10, offset: 20 });
    assert.equal(calls, 2);
    assert.equal(result.total, 61);
    assert.equal(result.products[0].name, 'Lamp');
});

test('product CRUD validates references against the same site and scopes writes by site and record id', async (t) => {
    const operations = [];
    t.mock.method(pool, 'connect', async () => ({
        async query(sql, values) {
            operations.push([sql, values]);
            if (sql.includes('FROM product_categories')) return { rowCount: 1 };
            if (sql.includes('FROM media')) return { rowCount: 1 };
            if (sql.includes('UPDATE products')) return { rows: [{ id: productId, category_id: 'category-a', name: 'Lamp', description: '', media_id: 'media-a', price: '12.00', type: 'goods', sort_order: 1, status: 'published' }] };
            return { rows: [] };
        }, release() {},
    }));
    const saved = await saveCatalogProduct('site-a', { id: productId, categoryId, name: 'Lamp', description: '', mediaId: '33333333-3333-4333-8333-333333333333', price: '12', type: 'goods', sortOrder: 1, status: 'published' });
    assert.equal(saved.name, 'Lamp');
    const update = operations.find(([sql]) => sql.includes('UPDATE products'));
    assert.match(update[0], /WHERE site_id = \$1 AND id = \$2/);
    assert.equal(update[1][0], 'site-a');
    assert.equal(update[1][1], productId);
    assert.throws(() => normalizeProduct({ id: 'invalid', name: 'Lamp' }), /идентификатор/);
});

test('product save rejects a foreign-site category before writing', async (t) => {
    const statements = [];
    t.mock.method(pool, 'connect', async () => ({
        async query(sql) { statements.push(sql); if (sql.includes('FROM product_categories')) return { rowCount: 0 }; return { rows: [] }; },
        release() {},
    }));
    await assert.rejects(saveCatalogProduct('site-a', { name: 'Lamp', categoryId: '11111111-1111-4111-8111-111111111111' }), /не принадлежит/);
    assert.ok(!statements.some((sql) => sql.includes('INSERT INTO products') || sql.includes('UPDATE products')));
    assert.ok(statements.includes('ROLLBACK'));
});

test('product save rejects a foreign-site image before writing', async (t) => {
    const statements = [];
    t.mock.method(pool, 'connect', async () => ({
        async query(sql) { statements.push(sql); if (sql.includes('FROM media')) return { rowCount: 0 }; return { rows: [] }; },
        release() {},
    }));
    await assert.rejects(saveCatalogProduct('site-a', { name: 'Lamp', mediaId: '33333333-3333-4333-8333-333333333333' }), /Изображение не принадлежит/);
    assert.ok(!statements.some((sql) => sql.includes('INSERT INTO products') || sql.includes('UPDATE products')));
});

test('category update is site-scoped and returns no record for another site', async (t) => {
    t.mock.method(pool, 'query', async (sql, values) => {
        assert.match(sql, /UPDATE product_categories SET name = \$3, sort_order = \$4 WHERE site_id = \$1 AND id = \$2/);
        assert.deepEqual(values, ['site-a', categoryId, 'Renamed', 4]);
        return { rows: [] };
    });
    assert.equal(await saveCatalogCategory('site-a', { id: categoryId, name: 'Renamed', sortOrder: 4 }), null);
});

test('parallel edits update only their own product rows', async (t) => {
    const editedIds = [];
    t.mock.method(pool, 'connect', async () => ({
        async query(sql, values) {
            if (sql.includes('UPDATE products')) {
                editedIds.push(values[1]);
                return { rows: [{ id: values[1], category_id: null, name: values[3], description: '', media_id: null, price: '1.00', type: 'service', sort_order: 0, status: 'published' }] };
            }
            return { rows: [] };
        },
        release() {},
    }));
    await Promise.all([
        saveCatalogProduct('site-a', { id: productId, name: 'First' }),
        saveCatalogProduct('site-a', { id: categoryId, name: 'Second' }),
    ]);
    assert.deepEqual(editedIds.sort(), [productId, categoryId].sort());
});

test('deleting a category unassigns its products without deleting them; product deletion leaves order items untouched', async (t) => {
    const categorySql = [];
    t.mock.method(pool, 'connect', async () => ({
        async query(sql, values) { categorySql.push(sql); if (sql.includes('SELECT id FROM product_categories')) return { rows: [{ id: values[1] }] }; return { rows: [] }; },
        release() {},
    }));
    assert.equal(await deleteCatalogCategory('site-a', '11111111-1111-4111-8111-111111111111'), true);
    assert.ok(categorySql.some((sql) => sql.includes('UPDATE products SET category_id = NULL') && sql.includes('WHERE site_id = $1 AND category_id = $2')));
    assert.ok(categorySql.some((sql) => sql.includes('DELETE FROM product_categories')));
    assert.ok(!categorySql.some((sql) => sql.includes('DELETE FROM products')));
    t.mock.method(pool, 'query', async (sql, values) => {
        assert.equal(sql, 'DELETE FROM products WHERE site_id = $1 AND id = $2');
        assert.deepEqual(values, ['site-a', productId]);
        return { rowCount: 1 };
    });
    assert.equal(await deleteCatalogProduct('site-a', productId), true);
});

test('category and uncategorized lists return counts for the admin selector', async (t) => {
    t.mock.method(pool, 'query', async (sql) => {
        if (sql.includes('GROUP BY c.id')) return { rows: [{ id: 'category-a', name: 'Lamps', sort_order: 0, product_count: 3 }] };
        return { rows: [{ total: 2 }] };
    });
    assert.deepEqual(await listCatalogCategories('site-a'), [{ id: 'category-a', name: 'Lamps', sortOrder: 0, productCount: 3 }]);
    assert.equal(await countUncategorizedProducts('site-a'), 2);
});

test('product list API validates filters and clamps pagination to a bounded page size', async (t) => {
    const calls = [];
    t.mock.method(pool, 'query', async (sql, values) => {
        calls.push([sql, values]);
        if (sql.includes('FROM sites')) return { rows: [{ id: 'site-a' }] };
        if (sql.includes('count(*)')) return { rows: [{ total: 0 }] };
        return { rows: [] };
    });
    const context = (query) => ({
        req: { header: () => 'site.localhost', query: (name) => name ? query[name] : query },
        json(value, status = 200) { return { value, status }; },
    });
    const invalid = await getSiteCatalogProducts(context({ type: 'other' }));
    assert.equal(invalid.status, 400);
    const result = await getSiteCatalogProducts(context({ categoryId: 'null', search: 'lamp', type: 'goods', status: 'hidden', limit: '5000', offset: '-8', siteId: 'foreign' }));
    assert.equal(result.status, 200);
    assert.deepEqual(result.value, { products: [], total: 0 });
    assert.ok(calls.some(([sql, values]) => sql.includes('FROM products') && values.includes(100)));
    assert.ok(calls.some(([sql, values]) => sql.includes('FROM products') && values.includes(0)));
    assert.ok(calls.every(([, values]) => !values?.includes('foreign')));
});
