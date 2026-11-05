import assert from 'node:assert/strict';
import test from 'node:test';
import { pool } from './client.mjs';
import { getPaymentIntegrations, savePaymentIntegration, setPaymentIntegrationActive, deletePaymentSecretKey } from './sitePaymentIntegrations.mjs';
import { getPaymentProvider, PaymentSettingsError } from '../server/payments/providers.mjs';

process.env.PAYMENT_ENCRYPTION_KEY = 'test-only-encryption-key-at-least-32-characters';

function database(t) {
    let rows = [];
    let snapshot;
    let locked = false;
    const calls = [];
    async function query(sql, values) {
        calls.push(sql);
        if (sql === 'BEGIN') { snapshot = structuredClone(rows); locked = false; return {}; }
        if (sql === 'ROLLBACK') { rows = snapshot; locked = false; return {}; }
        if (sql === 'COMMIT') { locked = false; return {}; }
        if (sql.includes('FROM sites')) {
            assert.match(sql, /WHERE id = \$1 FOR UPDATE/);
            locked = true;
            return { rows: [{ id: values[0] }] };
        }
        if (sql.startsWith('INSERT') || sql.startsWith('UPDATE')) assert.equal(locked, true, 'Writes must hold the site lock');
        if (sql.startsWith('INSERT')) {
            assert.match(sql, /ON CONFLICT \(site_id, provider\) DO UPDATE SET settings = site_payment_integrations.settings \|\| EXCLUDED.settings/);
            let row = rows.find((item) => item.site_id === values[0] && item.provider === values[1]);
            if (!row) { row = { site_id: values[0], provider: values[1], is_active: false }; rows.push(row); }
            row.settings = { ...row.settings, ...JSON.parse(values[2]) };
            return { rows: [structuredClone(row)] };
        }
        assert.match(sql, /WHERE site_id = \$1/);
        let selected = rows.filter((row) => row.site_id === values[0]);
        if (sql.startsWith('SELECT')) {
            if (values.length > 1) selected = selected.filter((row) => row.provider === values[1]);
            return { rows: structuredClone(selected) };
        }
        assert.match(sql, /^UPDATE site_payment_integrations/);
        if (sql.includes('provider <> $2')) {
            selected.filter((row) => row.provider !== values[1]).forEach((row) => { row.is_active = false; });
            return { rows: [] };
        }
        assert.match(sql, /provider = \$2/);
        selected = selected.filter((row) => row.provider === values[1]);
        if (sql.includes("settings = settings - 'secretKey'")) {
            assert.match(sql, /is_active = FALSE/);
            selected.forEach((row) => { delete row.settings.secretKey; row.is_active = false; });
            return { rows: structuredClone(selected) };
        }
        selected.forEach((row) => { row.is_active = values[2]; });
        return { rows: structuredClone(selected) };
    }
    t.mock.method(pool, 'query', query);
    t.mock.method(pool, 'connect', async () => ({ query, release() {} }));
    return { calls };
}
const validate = getPaymentProvider('prodamus').normalizeSettings;

test('isolates settings by site and keeps several provider records when switching and disabling', async (t) => {
    const fixture = database(t);
    await savePaymentIntegration('site-a', 'prodamus', { payformDomain: 'a.payform.ru', secretKey: 'TEST_A' });
    // A second provider is test data for the generic storage, not a registered production integration.
    await savePaymentIntegration('site-a', 'test-second', { payformDomain: 'second.payform.ru', secretKey: 'TEST_SECOND' });
    await savePaymentIntegration('site-b', 'prodamus', { payformDomain: 'b.payform.ru', secretKey: 'TEST_B' });
    await setPaymentIntegrationActive('site-b', 'prodamus', true, validate);
    await setPaymentIntegrationActive('site-a', 'prodamus', true, validate);
    await setPaymentIntegrationActive('site-a', 'test-second', true, validate);
    let saved = await getPaymentIntegrations('site-a');
    assert.deepEqual(saved.map(({ provider, settings, isActive }) => [provider, settings.payformDomain, isActive]), [
        ['prodamus', 'a.payform.ru', false], ['test-second', 'second.payform.ru', true],
    ]);
    await savePaymentIntegration('site-a', 'test-second', { payformDomain: 'updated.payform.ru' });
    assert.equal((await getPaymentIntegrations('site-a'))[1].isActive, true);
    await setPaymentIntegrationActive('site-a', 'test-second', false, validate);
    assert.equal((await getPaymentIntegrations('site-a')).some(({ isActive }) => isActive), false);
    assert.equal((await getPaymentIntegrations('site-b'))[0].isActive, true);
    assert.equal((await getPaymentIntegrations('site-b'))[0].settings.payformDomain, 'b.payform.ru');
    assert.ok(fixture.calls.includes('COMMIT'));
});

test('failed activation rolls back without disabling the currently active provider', async (t) => {
    const fixture = database(t);
    await savePaymentIntegration('site', 'prodamus', { payformDomain: 'ok.payform.ru', secretKey: 'TEST_KEY' });
    await setPaymentIntegrationActive('site', 'prodamus', true, validate);
    await savePaymentIntegration('site', 'test-invalid', {});
    await assert.rejects(setPaymentIntegrationActive('site', 'test-invalid', true, validate), PaymentSettingsError);
    await assert.rejects(setPaymentIntegrationActive('site', 'missing', true, validate), PaymentSettingsError);
    assert.equal((await getPaymentIntegrations('site'))[0].isActive, true);
    assert.ok(fixture.calls.includes('ROLLBACK'));
});

test('saving other settings preserves an existing secret under the same site transaction lock', async (t) => {
    database(t);
    await savePaymentIntegration('site', 'prodamus', { payformDomain: 'example.payform.ru', secretKey: 'PRIVATE_SENTINEL' });
    await savePaymentIntegration('site', 'prodamus', { payformDomain: 'example.payform.ru' });
    assert.equal((await getPaymentIntegrations('site'))[0].settings.secretKey, 'PRIVATE_SENTINEL');
});


test('deletes only the selected site/provider secret, deactivates atomically and supports repeated deletion', async (t) => {
    const fixture = database(t);
    for (const active of [false, true]) {
        await savePaymentIntegration('site', 'prodamus', { payformDomain: 'example.payform.ru', secretKey: 'PRIVATE_SENTINEL' });
        if (active) await setPaymentIntegrationActive('site', 'prodamus', true, validate);
        await savePaymentIntegration('other-site', 'prodamus', { payformDomain: 'other.payform.ru', secretKey: 'OTHER_SECRET' });
        await savePaymentIntegration('site', 'test-second', { secretKey: 'SECOND_SECRET' });
        await deletePaymentSecretKey('site', 'prodamus');
        const result = (await getPaymentIntegrations('site')).find(({ provider }) => provider === 'prodamus');
        assert.deepEqual(result.settings, { payformDomain: 'example.payform.ru' });
        assert.equal(Object.hasOwn(result.settings, 'secretKey'), false);
        assert.equal(result.isActive, false);
        await deletePaymentSecretKey('site', 'prodamus');
        assert.deepEqual((await getPaymentIntegrations('site')).find(({ provider }) => provider === 'prodamus'), result);
        assert.equal((await getPaymentIntegrations('other-site'))[0].settings.secretKey, 'OTHER_SECRET');
        assert.equal((await getPaymentIntegrations('site')).find(({ provider }) => provider === 'test-second').settings.secretKey, 'SECOND_SECRET');
    }
    await deletePaymentSecretKey('missing-site', 'prodamus');
    assert.deepEqual(await getPaymentIntegrations('missing-site'), []);
    assert.ok(fixture.calls.includes('COMMIT'));
});
