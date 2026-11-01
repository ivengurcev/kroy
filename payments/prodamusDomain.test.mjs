import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizePayformDomain, validatePaymentLink } from './prodamusDomain.mjs';

test('accepts only merchant domains in the confirmed payform.ru zone', () => {
    assert.equal(normalizePayformDomain('https://EXAMPLE.payform.ru/'), 'example.payform.ru');
    for (const domain of ['evil.com', 'payform.ru.evil.com', 'evilpayform.ru', '127.0.0.1', 'localhost', 'payform.ru', 'a.b.payform.ru', 'https://user@example.payform.ru', 'http://example.payform.ru', 'example.payform.ru:443', 'example.payform.ru/path', 'example.payform.ru?x', 'example.payform.ru#x', 'example.payform.ru.', 'example.payform.ru\\@evil.com']) {
        assert.throws(() => normalizePayformDomain(domain), /payform/);
    }
});

test('payment links allow short payform.ru links or the configured form only and never expose a request signature', () => {
    assert.equal(validatePaymentLink('https://payform.ru/Ab12/', 'example.payform.ru'), 'https://payform.ru/Ab12/');
    assert.equal(validatePaymentLink('https://example.payform.ru/payment/123', 'example.payform.ru'), 'https://example.payform.ru/payment/123');
    for (const link of ['http://payform.ru/1', 'https://payform.ru.evil.com/1', 'https://evil.com', 'https://other.payform.ru/1', 'https://user:pass@payform.ru/1', 'https://payform.ru:8443/1', 'https://payform.ru:443/1', '//payform.ru/1', 'https://payform.ru/1?signature=SECRET', 'https://payform.ru/1#signature=SECRET']) {
        assert.throws(() => validatePaymentLink(link, 'example.payform.ru'));
    }
});
