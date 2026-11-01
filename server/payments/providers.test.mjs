import assert from 'node:assert/strict';
import test from 'node:test';
import { getPaymentProvider, paymentProviders, describePaymentProvider, PaymentSettingsError } from './providers.mjs';

test('registers only Prodamus with RUB and a required site payform domain', () => {
    assert.deepEqual(Object.keys(paymentProviders), ['prodamus']);
    const provider = getPaymentProvider('prodamus');
    assert.equal(provider.name, 'Prodamus');
    assert.equal(provider.currency, 'RUB');
    assert.equal(provider.fields.payformDomain.required, true);
    assert.equal(provider.fields.payformDomain.default, '');
    assert.equal(provider.fields.sys, undefined);
    for (const id of ['unknown', '__proto__', null]) assert.throws(() => getPaymentProvider(id), PaymentSettingsError);
});

test('validates and normalizes Prodamus domains without credentials, paths or unsafe URL components', () => {
    const { normalizeSettings } = getPaymentProvider('prodamus');
    for (const value of ['example.payform.ru', ' EXAMPLE.payform.ru ', 'https://example.payform.ru/']) {
        assert.deepEqual(normalizeSettings({ payformDomain: value }), { payformDomain: 'example.payform.ru' });
    }
    for (const value of ['', null, 123, 'localhost', '127.0.0.1', 'http://example.payform.ru', 'https://user:pass@example.payform.ru', 'example.payform.ru/path', 'example.payform.ru?x=1', 'example.payform.ru#x', 'example.payform.ru:443', '-bad.payform.ru', 'example..ru', 'javascript:alert(1)']) {
        assert.throws(() => normalizeSettings({ payformDomain: value }), PaymentSettingsError);
    }
    for (const value of [undefined, null, [], {}, { payformDomain: 'example.payform.ru', sys: 'site-code' }]) {
        assert.throws(() => normalizeSettings(value), PaymentSettingsError);
    }
});

test('exposes only explicitly readable settings in the private admin descriptor, never raw provider settings', () => {
    const provider = getPaymentProvider('prodamus');
    const descriptor = describePaymentProvider(provider, { settings: { payformDomain: 'example.payform.ru', secretToken: 'PRIVATE_SENTINEL' }, isActive: true });
    assert.deepEqual(descriptor.settings, { payformDomain: 'example.payform.ru' });
    assert.equal(JSON.stringify(descriptor).includes('PRIVATE_SENTINEL'), false);
    const testDefinition = { ...provider, fields: { ...provider.fields, secretToken: { label: 'Token', type: 'password', default: 'PRIVATE_DEFAULT', required: true } } };
    const redacted = describePaymentProvider(testDefinition, { settings: { secretToken: 'PRIVATE_SENTINEL' } });
    assert.equal(JSON.stringify(redacted).includes('PRIVATE_'), false);
    assert.equal(redacted.settings.secretToken, undefined);
});

test('secret keys are accepted for storage but never returned, and blank input means keep the stored value', () => {
    const provider = getPaymentProvider('prodamus');
    assert.equal(provider.fields.secretKey.type, 'password');
    assert.equal(provider.fields.secretKey.readable, false);
    const settings = provider.normalizeSettings({ payformDomain: 'example.payform.ru', secretKey: 'PRIVATE_SENTINEL' });
    const result = describePaymentProvider(provider, { settings, isActive: true });
    assert.equal(result.fields.secretKey.configured, true);
    assert.equal(result.settings.secretKey, undefined);
    assert.equal(JSON.stringify(result).includes('PRIVATE_SENTINEL'), false);
    assert.deepEqual(provider.normalizeSettings({ payformDomain: 'example.payform.ru', secretKey: '' }), { payformDomain: 'example.payform.ru' });
    assert.throws(() => provider.normalizeSettings({ payformDomain: 'example.payform.ru', secretKey: null }), PaymentSettingsError);
});
