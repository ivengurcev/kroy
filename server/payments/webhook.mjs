import { normalizePayformDomain } from './prodamusDomain.mjs';
import { verifyProdamusSignature } from './prodamus.mjs';
import PaymentError from './paymentError.mjs';
import isUuid from '../api/isUuid.mjs';

export function normalizeWebhook(data, settings, signature) {
    const isTest = String(data._param_oysite_test ?? '') === '1' || String(data.demo_mode ?? '') === '1';
    // Prodamus can sign demo callbacks with secret + "demo". Never accept that key for live orders.
    if (!verifyProdamusSignature(data, settings.secretKey, signature)
        && !(isTest && verifyProdamusSignature(data, `${settings.secretKey}demo`, signature))) {
        throw new PaymentError('Неверная подпись.', 403);
    }
    if (!isUuid(data.order_num) || !/^\d{1,30}$/.test(String(data.order_id))
        || !['success', 'order_canceled', 'order_denied'].includes(data.payment_status)
        || typeof data.sum !== 'string' || !/^\d{1,10}(?:\.\d{1,2})?$/.test(data.sum)
        || typeof data.currency !== 'string' || data.currency.toLowerCase() !== 'rub'
        || data.subscription || data.payment_init === 'auto') {
        throw new PaymentError('Некорректное уведомление.', 400);
    }
    let domain;
    try { domain = normalizePayformDomain(data.domain); }
    catch { throw new PaymentError('Некорректная платёжная форма.', 400); }
    if (domain !== settings.payformDomain) throw new PaymentError('Другая платёжная форма.', 400);
    const [whole, fraction = ''] = data.sum.split('.');
    const amount = `${BigInt(whole)}.${fraction.padEnd(2, '0')}`;
    const paidAt = typeof data.date === 'string' && /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(data.date) ? new Date(data.date) : null;
    if (!paidAt || Number.isNaN(paidAt.getTime())) throw new PaymentError('Некорректная дата платежа.', 400);
    function contact(key, max) {
        if (data[key] === undefined || data[key] === '') return null;
        if (typeof data[key] !== 'string' || data[key].length > max) throw new PaymentError('Некорректные контакты.', 400);
        return data[key];
    }
    return { orderId: data.order_num, externalId: String(data.order_id), domain, amount, currency: 'RUB',
        isTest, status: data.payment_status, paidAt: paidAt.toISOString(),
        phone: contact('customer_phone', 100), email: contact('customer_email', 320), extra: contact('customer_extra', 5000) };
}
