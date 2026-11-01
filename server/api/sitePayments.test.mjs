import assert from 'node:assert/strict';
import test from 'node:test';
import { pool } from '../../db/client.mjs';
import { getSitePayments, patchSitePaymentSettings, patchSitePaymentActivation, deleteSitePaymentSecretKey } from './sitePayments.mjs';

function context(provider = 'prodamus', body = {}) {
    return {
        req: { header: () => 'site.localhost', param: () => provider, async json() { return body; } },
        json(value, status = 200) { return { value, status }; },
    };
}

function database(t, stored = []) {
    let settings = stored;
    t.mock.method(pool, 'query', async (sql, values) => {
        if (sql.includes('FROM sites s')) return { rows: [{ id: 'current-site' }] };
        assert.match(sql, /WHERE site_id = \$1/);
        assert.equal(values[0], 'current-site');
        return { rows: structuredClone(settings) };
    });
    t.mock.method(pool, 'connect', async () => ({ async query(sql, values) {
        if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return {};
        assert.equal(values[0], 'current-site');
        if (sql.includes('FROM sites')) return { rows: [{ id: 'current-site' }] };
        if (sql.startsWith('INSERT')) {
            assert.equal(values[1], 'prodamus');
            settings = [{ provider: 'prodamus', settings: { ...settings[0]?.settings, ...JSON.parse(values[2]) }, is_active: settings[0]?.is_active ?? false }];
            return { rows: structuredClone(settings) };
        }
        if (sql.startsWith('SELECT')) return { rows: structuredClone(settings) };
        assert.match(sql, /^UPDATE site_payment_integrations/);
        if (sql.includes("settings = settings - 'secretKey'")) {
            assert.match(sql, /is_active = FALSE/);
            assert.match(sql, /WHERE site_id = \$1 AND provider = \$2/);
            assert.equal(values[1], 'prodamus');
            settings.forEach((row) => { delete row.settings.secretKey; row.is_active = false; });
        }
        if (sql.includes('SET is_active = $3')) settings.forEach((row) => { row.is_active = values[2]; });
        return {};
    }, release() {} }));
}

test('private API lists registered providers, saves normalized settings and activates/deactivates the current site', async (t) => {
    database(t);
    const initial = await getSitePayments(context());
    assert.equal(initial.status, 200);
    assert.equal(initial.value.providers.length, 1);
    assert.deepEqual(initial.value.providers[0].settings, { payformDomain: '' });
    const saved = await patchSitePaymentSettings(context('prodamus', { settings: { payformDomain: 'EXAMPLE.payform.ru' } }));
    assert.equal(saved.status, 200);
    assert.deepEqual(saved.value.providers[0].settings, { payformDomain: 'example.payform.ru' });
    const active = await patchSitePaymentActivation(context('prodamus', { isActive: true }));
    assert.equal(active.value.providers[0].isActive, true);
    const disabled = await patchSitePaymentActivation(context('prodamus', { isActive: false }));
    assert.equal(disabled.value.providers[0].isActive, false);
});

test('rejects unknown providers, invalid settings, malformed bodies and non-boolean activation before persistence', async (t) => {
    t.mock.method(pool, 'query', () => { assert.fail('Invalid input must not reach the database'); });
    for (const [provider, body] of [
        ['unknown', { settings: { payformDomain: 'example.payform.ru' } }],
        ['__proto__', { settings: {} }], ['prodamus', { settings: {} }],
        ['prodamus', { settings: { payformDomain: 'bad/path' } }], ['prodamus', []],
        ['prodamus', { settings: { payformDomain: 'example.payform.ru' }, isActive: true }],
    ]) assert.equal((await patchSitePaymentSettings(context(provider, body))).status, 400);
    for (const body of [{}, { isActive: 'true' }, { isActive: 1 }, { isActive: true, settings: {} }]) {
        assert.equal((await patchSitePaymentActivation(context('prodamus', body))).status, 400);
    }
    assert.equal((await patchSitePaymentActivation(context('unknown', { isActive: true }))).status, 400);
    const malformed = context();
    malformed.req.json = async () => { throw new SyntaxError('Invalid JSON'); };
    assert.equal((await patchSitePaymentSettings(malformed)).status, 400);
});

test('does not activate unconfigured or invalid stored settings and never returns unknown secret settings', async (t) => {
    database(t);
    assert.equal((await patchSitePaymentActivation(context('prodamus', { isActive: true }))).status, 400);
    database(t, [{ provider: 'prodamus', settings: { payformDomain: '', secretKey: 'PRIVATE_SENTINEL' }, is_active: false }]);
    assert.equal((await patchSitePaymentActivation(context('prodamus', { isActive: true }))).status, 400);
    const result = await getSitePayments(context());
    assert.equal(JSON.stringify(result).includes('PRIVATE_SENTINEL'), false);
});

test('returns 404 for an absent site and 500 for internal failures', async (t) => {
    t.mock.method(pool, 'query', async () => ({ rows: [] }));
    assert.equal((await getSitePayments(context())).status, 404);
    t.mock.method(pool, 'query', async () => { throw new Error('Database unavailable'); });
    t.mock.method(console, 'error', () => {});
    assert.equal((await getSitePayments(context())).status, 500);
    assert.equal((await patchSitePaymentSettings(context('prodamus', { settings: { payformDomain: 'example.payform.ru' } }))).status, 500);
    assert.equal((await patchSitePaymentActivation(context('prodamus', { isActive: false }))).status, 500);
});

test('admin can set a secret and later save a blank password without erasing or disclosing it', async (t) => {
    database(t);
    let response = await patchSitePaymentSettings(context('prodamus', { settings: { payformDomain: 'example.payform.ru', secretKey: 'PRIVATE_SENTINEL' } }));
    assert.equal(response.status, 200);
    assert.equal(response.value.providers[0].fields.secretKey.configured, true);
    assert.doesNotMatch(JSON.stringify(response), /PRIVATE_SENTINEL/);
    response = await patchSitePaymentSettings(context('prodamus', { settings: { payformDomain: 'example.payform.ru', secretKey: '' } }));
    assert.equal(response.status, 200);
    assert.equal(response.value.providers[0].fields.secretKey.configured, true);
    assert.equal(response.value.providers[0].settings.secretKey, undefined);
});


test('deleting a saved active secret deactivates the integration, never exposes values and is idempotent', async (t) => {
    database(t, [{ provider: 'prodamus', settings: { payformDomain: 'example.payform.ru', secretKey: 'PRIVATE_SENTINEL' }, is_active: true }]);
    for (let attempt = 0; attempt < 2; attempt += 1) {
        const result = await deleteSitePaymentSecretKey(context());
        assert.equal(result.status, 200);
        assert.equal(result.value.providers[0].isActive, false);
        assert.equal(result.value.providers[0].fields.secretKey.configured, false);
        assert.equal(result.value.providers[0].settings.secretKey, undefined);
        assert.doesNotMatch(JSON.stringify(result), /PRIVATE_SENTINEL/);
        assert.deepEqual(result.value.providers[0].settings, { payformDomain: 'example.payform.ru' });
    }
});

test('secret deletion rejects unknown providers, absent sites and internal failures safely', async (t) => {
    t.mock.method(pool, 'query', () => { assert.fail('Unknown provider must be rejected before database access'); });
    assert.equal((await deleteSitePaymentSecretKey(context('unknown'))).status, 400);
    t.mock.method(pool, 'query', async () => ({ rows: [] }));
    assert.equal((await deleteSitePaymentSecretKey(context())).status, 404);
    t.mock.method(pool, 'query', async () => { throw new Error('PRIVATE_SENTINEL'); });
    t.mock.method(console, 'error', () => {});
    const result = await deleteSitePaymentSecretKey(context());
    assert.equal(result.status, 500);
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE_SENTINEL/);
});
