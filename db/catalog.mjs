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

function productType(value = 'service') {
    if (!['service', 'goods'].includes(value)) throw new Error('Тип позиции должен быть «Услуга» или «Товар».');
    return value;
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
        price: price(item?.price), type: productType(item?.type), sortOrder: Number.isInteger(item?.sortOrder) ? item.sortOrder : index,
        status: item?.status === 'hidden' ? 'hidden' : 'published',
    })) : [];
    return { categories, products };
}

function mapCategory(row) {
    return { id: row.id, name: row.name, sortOrder: row.sort_order };
}

function mapProduct(row) {
    return { id: row.id, categoryId: row.category_id, name: row.name, description: row.description, mediaId: row.media_id, price: row.price, type: row.type, sortOrder: row.sort_order, status: row.status };
}

export function normalizeCategory(value = {}) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Некорректные данные раздела.');
    if (value.id !== undefined && value.id !== null && !uuid(value.id)) throw new Error('Некорректный идентификатор раздела.');
    const name = requiredText(value.name, 'Название раздела', 200);
    const sortOrder = Number.isInteger(value.sortOrder) ? value.sortOrder : 0;
    return { id: uuid(value.id), name, sortOrder };
}

export function normalizeProduct(value = {}) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Некорректные данные товара.');
    if (value.id !== undefined && value.id !== null && !uuid(value.id)) throw new Error('Некорректный идентификатор товара.');
    if (value.categoryId != null && !uuid(value.categoryId)) throw new Error('Некорректный раздел товара.');
    if (value.mediaId != null && !uuid(value.mediaId)) throw new Error('Некорректное изображение товара.');
    return {
        id: uuid(value.id), categoryId: value.categoryId || null,
        name: requiredText(value.name, 'Название товара/услуги', 200), description: text(value.description, 2000),
        mediaId: value.mediaId || null, price: price(value.price), type: productType(value.type),
        sortOrder: Number.isInteger(value.sortOrder) ? value.sortOrder : 0,
        status: value.status === 'hidden' ? 'hidden' : 'published',
    };
}

async function validateProductReferences(siteId, product, client) {
    if (product.categoryId) {
        const { rowCount } = await client.query('SELECT 1 FROM product_categories WHERE site_id = $1 AND id = $2', [siteId, product.categoryId]);
        if (!rowCount) throw new Error('Раздел не принадлежит текущему сайту.');
    }
    if (product.mediaId) {
        const { rowCount } = await client.query('SELECT 1 FROM media WHERE site_id = $1 AND id = $2', [siteId, product.mediaId]);
        if (!rowCount) throw new Error('Изображение не принадлежит текущему сайту.');
    }
}

export async function listCatalogCategories(siteId) {
    const { rows } = await pool.query(`SELECT c.id, c.name, c.sort_order, count(p.id)::int AS product_count
        FROM product_categories c LEFT JOIN products p ON p.site_id = c.site_id AND p.category_id = c.id
        WHERE c.site_id = $1 GROUP BY c.id ORDER BY c.sort_order, c.id`, [siteId]);
    return rows.map((row) => ({ ...mapCategory(row), productCount: row.product_count }));
}

export async function countUncategorizedProducts(siteId) {
    const { rows: [row] } = await pool.query('SELECT count(*)::int AS total FROM products WHERE site_id = $1 AND category_id IS NULL', [siteId]);
    return row.total;
}

export async function saveCatalogCategory(siteId, input) {
    const category = normalizeCategory(input);
    const { rows: [row] } = await pool.query(category.id
        ? `UPDATE product_categories SET name = $3, sort_order = $4 WHERE site_id = $1 AND id = $2 RETURNING id, name, sort_order`
        : `INSERT INTO product_categories (site_id, name, sort_order) VALUES ($1, $2, $3) RETURNING id, name, sort_order`,
    category.id ? [siteId, category.id, category.name, category.sortOrder] : [siteId, category.name, category.sortOrder]);
    return row ? mapCategory(row) : null;
}

export async function deleteCatalogCategory(siteId, categoryId) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { rows: [category] } = await client.query('SELECT id FROM product_categories WHERE site_id = $1 AND id = $2 FOR UPDATE', [siteId, categoryId]);
        if (!category) { await client.query('ROLLBACK'); return false; }
        await client.query('UPDATE products SET category_id = NULL, updated_at = now() WHERE site_id = $1 AND category_id = $2', [siteId, categoryId]);
        await client.query('DELETE FROM product_categories WHERE site_id = $1 AND id = $2', [siteId, categoryId]);
        await client.query('COMMIT');
        return true;
    } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
    finally { client.release(); }
}

export async function listCatalogProducts(siteId, { categoryId, search = '', type, status, limit = 50, offset = 0 } = {}) {
    const values = [siteId];
    const conditions = ['site_id = $1'];
    if (categoryId === 'null') conditions.push('category_id IS NULL');
    else if (categoryId) { values.push(categoryId); conditions.push(`category_id = $${values.length}`); }
    if (search) { values.push(`%${search}%`); conditions.push(`(name ILIKE $${values.length} OR description ILIKE $${values.length})`); }
    if (type) { values.push(type); conditions.push(`type = $${values.length}`); }
    if (status) { values.push(status); conditions.push(`status = $${values.length}`); }
    const where = conditions.join(' AND ');
    const { rows: [count] } = await pool.query(`SELECT count(*)::int AS total FROM products WHERE ${where}`, values);
    const productValues = [...values, limit, offset];
    const { rows } = await pool.query(`SELECT id, category_id, name, description, media_id, price, type, sort_order, status
        FROM products WHERE ${where} ORDER BY sort_order, id LIMIT $${values.length + 1} OFFSET $${values.length + 2}`, productValues);
    return { products: rows.map(mapProduct), total: count.total };
}

export async function saveCatalogProduct(siteId, input) {
    const product = normalizeProduct(input);
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await validateProductReferences(siteId, product, client);
        const { rows: [row] } = await client.query(product.id
            ? `UPDATE products SET category_id = $3, name = $4, description = $5, media_id = $6, price = $7::numeric, type = $8, sort_order = $9, status = $10, updated_at = now()
                WHERE site_id = $1 AND id = $2 RETURNING id, category_id, name, description, media_id, price, type, sort_order, status`
            : `INSERT INTO products (site_id, category_id, name, description, media_id, price, type, sort_order, status)
                VALUES ($1, $2, $3, $4, $5, $6::numeric, $7, $8, $9) RETURNING id, category_id, name, description, media_id, price, type, sort_order, status`,
        product.id
            ? [siteId, product.id, product.categoryId, product.name, product.description, product.mediaId, product.price, product.type, product.sortOrder, product.status]
            : [siteId, product.categoryId, product.name, product.description, product.mediaId, product.price, product.type, product.sortOrder, product.status]);
        await client.query('COMMIT');
        return row ? mapProduct(row) : null;
    } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
    finally { client.release(); }
}

export async function deleteCatalogProduct(siteId, productId) {
    const { rowCount } = await pool.query('DELETE FROM products WHERE site_id = $1 AND id = $2', [siteId, productId]);
    return rowCount > 0;
}

export async function getCatalog(siteId, { includeHidden = true } = {}) {
    const [categories, products] = await Promise.all([
        pool.query('SELECT id, name, sort_order FROM product_categories WHERE site_id = $1 ORDER BY sort_order, id', [siteId]),
        pool.query(`SELECT id, category_id, name, description, media_id, price, type, sort_order, status
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
            const result = await client.query(`INSERT INTO products (id, site_id, category_id, name, description, media_id, price, type, sort_order, status)
                VALUES (COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, $7::numeric, $8, $9, $10)
                ON CONFLICT (id) DO UPDATE SET category_id = EXCLUDED.category_id, name = EXCLUDED.name, description = EXCLUDED.description,
                    media_id = EXCLUDED.media_id, price = EXCLUDED.price, type = EXCLUDED.type, sort_order = EXCLUDED.sort_order, status = EXCLUDED.status, updated_at = now()
                    WHERE products.site_id = EXCLUDED.site_id
                RETURNING id`, [product.id, siteId, product.categoryId, product.name, product.description, product.mediaId, product.price, product.type, index, product.status]);
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

export async function getProductForPayment(siteId, productId, client = pool) {
    const { rows: [product] } = await client.query(
        `SELECT id, name, price, type FROM products WHERE site_id = $1 AND id = $2 AND status = 'published'${client === pool ? '' : ' FOR SHARE'}`,
        [siteId, productId],
    );
    return product ?? null;
}
