import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { randomUUID } from 'node:crypto';
import { pool } from './client.mjs';
import { getPaymentIntegrations, savePaymentIntegration, setPaymentIntegrationActive, deletePaymentSecretKey } from './sitePaymentIntegrations.mjs';
import { getPaymentProvider } from '../server/payments/providers.mjs';

after(() => pool.end());

test('PostgreSQL enforces one active provider under concurrent switching and preserves per-site settings and product defaults', async (t) => {
    if (process.env.RUN_PAYMENT_INTEGRATION_TESTS !== '1') {
        t.skip('Set RUN_PAYMENT_INTEGRATION_TESTS=1 after applying migrations to an isolated test database');
        return;
    }
    assert.match(process.env.PAYMENT_TEST_DATABASE ?? '', /test/, 'An explicitly named isolated test database is required');
    const { rows: [{ current_database: currentDatabase }] } = await pool.query('SELECT current_database()');
    assert.equal(currentDatabase, process.env.PAYMENT_TEST_DATABASE);
    const siteIds = [];
    const validate = getPaymentProvider('prodamus').normalizeSettings;
    try {
        for (const name of ['a', 'b']) {
            const { rows: [site] } = await pool.query('INSERT INTO sites (slug, name) VALUES ($1, $2) RETURNING id', [`payments-${name}-${randomUUID()}`, 'Payments test']);
            siteIds.push(site.id);
        }
        const [siteA, siteB] = siteIds;
        await savePaymentIntegration(siteA, 'prodamus', { payformDomain: 'a.payform.ru', secretKey: 'TEST_A' });
        await savePaymentIntegration(siteA, 'test-second', { payformDomain: 'second.payform.ru', secretKey: 'TEST_SECOND' });
        await savePaymentIntegration(siteB, 'prodamus', { payformDomain: 'b.payform.ru', secretKey: 'TEST_B' });
        await setPaymentIntegrationActive(siteB, 'prodamus', true, validate);
        await Promise.all([
            setPaymentIntegrationActive(siteA, 'prodamus', true, validate),
            setPaymentIntegrationActive(siteA, 'test-second', true, validate),
        ]);
        const saved = await getPaymentIntegrations(siteA);
        assert.equal(saved.filter(({ isActive }) => isActive).length, 1);
        assert.deepEqual(saved.map(({ settings }) => settings.payformDomain).sort(), ['a.payform.ru', 'second.payform.ru']);
        await assert.rejects(pool.query('UPDATE site_payment_integrations SET is_active = TRUE WHERE site_id = $1', [siteA]), { code: '23505' });
        await savePaymentIntegration(siteB, 'prodamus', { payformDomain: 'b.payform.ru', secretKey: 'PRIVATE_TEST_SECRET' });
        await savePaymentIntegration(siteB, 'prodamus', { payformDomain: 'b.payform.ru' });
        assert.equal((await getPaymentIntegrations(siteB))[0].settings.secretKey, 'PRIVATE_TEST_SECRET');
        const otherSite = await getPaymentIntegrations(siteB);
        assert.equal(otherSite[0].settings.payformDomain, 'b.payform.ru');
        assert.equal(otherSite[0].isActive, true);
        await deletePaymentSecretKey(siteB, 'prodamus');
        await deletePaymentSecretKey(siteB, 'prodamus');
        const deleted = (await getPaymentIntegrations(siteB))[0];
        assert.equal(Object.hasOwn(deleted.settings, 'secretKey'), false);
        assert.equal(deleted.isActive, false);
        assert.equal(deleted.settings.payformDomain, 'b.payform.ru');
        await setPaymentIntegrationActive(siteA, saved.find(({ isActive }) => isActive).provider, false, validate);
        assert.equal((await getPaymentIntegrations(siteA)).some(({ isActive }) => isActive), false);
        const { rows: [product] } = await pool.query('INSERT INTO products (site_id, name) VALUES ($1, $2) RETURNING id, type', [siteA, 'Default service']);
        assert.equal(product.type, 'service');
        await pool.query("UPDATE products SET type = 'goods' WHERE id = $1", [product.id]);
        assert.equal((await pool.query('SELECT type FROM products WHERE id = $1', [product.id])).rows[0].type, 'goods');
        await assert.rejects(pool.query("UPDATE products SET type = 'invalid' WHERE id = $1", [product.id]), { code: '23514' });
    } finally {
        for (const id of siteIds) await pool.query('DELETE FROM sites WHERE id = $1', [id]);
    }
});
