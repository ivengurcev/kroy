import { pool } from './client.mjs';

export const EMPTY_CATALOG = { categories: [], products: [] };

function text(value, max) {
    return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function requiredText(value, label, max) {
    const result = text(value, max);
    if (!result) throw new Error(`${label} не может быть пустым.`);
    return result;
}

function uuid(value) {
    return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
        ? value
        : null;
}

function price(value) {
    if (value === '' || value === null || value === undefined) return '0.00';
    const source = String(value).trim();
    if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(source)) throw new Error('Цена должна быть неотрицательным числом до двух знаков после запятой.');
    return Number(source).toFixed(2);
}

function paymentUrl(value) {
    const source = text(value, 1000);
    if (!source) return '';
    let url;
    try { url = new URL(source); } catch { throw new Error('Ссылка Prodamus должна быть корректным HTTPS-адресом.'); }
    if (url.protocol !== 'https:') throw new Error('Ссылка Prodamus должна быть корректным HTTPS-адресом.');
    return url.href;
}

export function normalizeCatalog(value = {}) {
    const source = value && typeof value === 'object' ? value : {};
    const categories = Array.isArray(source.categories) ? source.categories.slice(0, 500).map((item, index) => ({
        id: uuid(item?.id), name: requiredText(item?.name, 'Название категории', 200), sortOrder: Number.isInteger(item?.sortOrder) ? item.sortOrder : index,
    })) : [];
    const categoryIds = new Set(categories.map((item) => item.id).filter(Boolean));
    const products = Array.isArray(source.products) ? source.products.slice(0, 5000).map((item, index) => ({
        id: uuid(item?.id), categoryId: item?.categoryId && categoryIds.has(item.categoryId) ? item.categoryId : null,
        name: requiredText(item?.name, 'Название товара/услуги', 200), description: text(item?.description, 2000), mediaId: uuid(item?.mediaId),
        price: price(item?.price), paymentUrl: paymentUrl(item?.paymentUrl), sortOrder: Number.isInteger(item?.sortOrder) ? item.sortOrder : index,
        status: item?.status === 'hidden' ? 'hidden' : 'published',
    })) : [];
    return { categories, products };
}

function mapCategory(row) {
    return { id: row.id, name: row.name, sortOrder: row.sort_order };
}

function mapProduct(row) {
    return { id: row.id, categoryId: row.category_id, name: row.name, description: row.description, mediaId: row.media_id, price: row.price, paymentUrl: row.payment_url, sortOrder: row.sort_order, status: row.status };
}

export async function getCatalog(siteId, { includeHidden = true } = {}) {
    const [categories, products] = await Promise.all([
        pool.query('SELECT id, name, sort_order FROM product_categories WHERE site_id = $1 ORDER BY sort_order, id', [siteId]),
        pool.query(`SELECT id, category_id, name, description, media_id, price, payment_url, sort_order, status
                    FROM products WHERE site_id = $1 ${includeHidden ? '' : "AND status = 'published'"}
                    ORDER BY category_id NULLS FIRST, sort_order, id`, [siteId]),
    ]);
    return { categories: categories.rows.map(mapCategory), products: products.rows.map(mapProduct) };
}

export async function setCatalog(siteId, value) {
    const catalog = normalizeCatalog(value);
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const mediaIds = catalog.products.map((product) => product.mediaId).filter(Boolean);
        if (mediaIds.length) {
            const mediaResult = await client.query('SELECT count(*)::int AS count FROM media WHERE site_id = $1 AND id = ANY($2::uuid[])', [siteId, mediaIds]);
            if (mediaResult.rows[0].count !== mediaIds.length) throw new Error('Изображение не принадлежит текущему сайту.');
        }
        const categoryIds = [];
        for (const [index, category] of catalog.categories.entries()) {
            const result = await client.query(`INSERT INTO product_categories (id, site_id, name, sort_order)
                VALUES (COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4)
                ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order
                    WHERE product_categories.site_id = EXCLUDED.site_id
                RETURNING id`, [category.id, siteId, category.name, index]);
            categoryIds.push(result.rows[0].id);
        }
        await client.query('DELETE FROM product_categories WHERE site_id = $1 AND NOT (id = ANY($2::uuid[]))', [siteId, categoryIds]);
        const productIds = [];
        for (const [index, product] of catalog.products.entries()) {
            const result = await client.query(`INSERT INTO products (id, site_id, category_id, name, description, media_id, price, payment_url, sort_order, status)
                VALUES (COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, $7::numeric, $8, $9, $10)
                ON CONFLICT (id) DO UPDATE SET category_id = EXCLUDED.category_id, name = EXCLUDED.name, description = EXCLUDED.description,
                    media_id = EXCLUDED.media_id, price = EXCLUDED.price, payment_url = EXCLUDED.payment_url, sort_order = EXCLUDED.sort_order, status = EXCLUDED.status, updated_at = now()
                    WHERE products.site_id = EXCLUDED.site_id
                RETURNING id`, [product.id, siteId, product.categoryId, product.name, product.description, product.mediaId, product.price, product.paymentUrl, index, product.status]);
            productIds.push(result.rows[0].id);
        }
        await client.query('DELETE FROM products WHERE site_id = $1 AND NOT (id = ANY($2::uuid[]))', [siteId, productIds]);
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
    } finally { client.release(); }
    return getCatalog(siteId);
}
