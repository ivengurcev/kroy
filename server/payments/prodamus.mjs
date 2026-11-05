import { createHmac, timingSafeEqual } from 'node:crypto';
import { normalizePayformDomain, validatePaymentLink } from './prodamusDomain.mjs';
import PaymentError from './paymentError.mjs';

function canonicalValues(value) {
    if (Array.isArray(value)) return value.map(canonicalValues);
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalValues(value[key])]));
    }
    return String(value);
}

export function signProdamusRequest(data, secretKey) {
    const canonical = JSON.stringify(canonicalValues(data)).replaceAll('/', '\\/');
    return createHmac('sha256', secretKey).update(canonical, 'utf8').digest('hex');
}

async function readPaymentLink(response) {
    if (!response.ok || !response.body) throw new Error('Invalid payment response');
    const reader = response.body.getReader();
    const chunks = [];
    let length = 0;
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            length += value.length;
            if (length > 4096) throw new Error('Payment response too large');
            chunks.push(value);
        }
        return Buffer.concat(chunks).toString('utf8').trim();
    } finally {
        await reader.cancel().catch(() => {});
    }
}

export async function createProdamusPaymentLink(product, settings, sys, order = null) {
    if (typeof settings.secretKey !== 'string' || !settings.secretKey.trim()) {
        throw new PaymentError('Оплата временно недоступна.', 503);
    }
    let domain;
    try { domain = normalizePayformDomain(settings.payformDomain); }
    catch { throw new PaymentError('Оплата временно недоступна.', 503); }
    const data = {
        do: 'link', ...(sys?.trim() ? { sys: sys.trim() } : {}), currency: 'rub',
        products: [{ name: product.name, price: product.price, quantity: 1, sku: product.id, type: product.type }],
        ...(order ? { order_id: order.id, urlReturn: order.returnUrl, urlSuccess: order.returnUrl, payments_limit: 1 } : {}),
        ...(settings.testMode ? { demo_mode: 1, _param_oysite_test: 1 } : {}),
    };
    const signature = signProdamusRequest(data, settings.secretKey);
    const body = new URLSearchParams(Object.entries(data).filter(([key]) => key !== 'products'));
    for (const [key, value] of Object.entries(data.products[0])) body.set(`products[0][${key}]`, String(value));
    body.set('signature', signature);
    try {
        const response = await fetch(`https://${domain}/`, {
            method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10_000),
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString(),
        });
        const link = validatePaymentLink(await readPaymentLink(response), domain);
        const decodedLink = decodeURIComponent(link);
        if (decodedLink.includes(settings.secretKey) || decodedLink.toLowerCase().includes(signature)) throw new Error('Invalid payment response');
        return link;
    } catch (error) {
        throw new PaymentError('Не удалось начать оплату. Попробуйте позже.', ['TimeoutError', 'AbortError'].includes(error.name) ? 504 : 502);
    }
}

export function verifyProdamusSignature(data, secretKey, signature) {
    if (typeof signature !== 'string' || !/^[a-f0-9]{64}$/i.test(signature) || !secretKey) return false;
    return timingSafeEqual(Buffer.from(signProdamusRequest(data, secretKey), 'hex'), Buffer.from(signature, 'hex'));
}

// Reconstruct PHP-style nested arrays before verifying Sign; never mix URL query parameters into the payload.
export function parseProdamusForm(body) {
    const root = Object.create(null);
    for (const [key, value] of new URLSearchParams(body)) {
        if (!/^[a-zA-Z0-9_]+(?:\[[a-zA-Z0-9_]+\])*$/.test(key)) throw new PaymentError('Некорректное уведомление.', 400);
        const parts = key.match(/[a-zA-Z0-9_]+/g);
        if (parts.length > 8 || parts.some((part) => ['__proto__', 'constructor', 'prototype'].includes(part))) throw new PaymentError('Некорректное уведомление.', 400);
        let target = root;
        parts.forEach((part, index) => {
            if (index === parts.length - 1) {
                if (Object.hasOwn(target, part)) throw new PaymentError('Повторное поле уведомления.', 400);
                target[part] = value;
            } else {
                if (Object.hasOwn(target, part) && typeof target[part] !== 'object') throw new PaymentError('Некорректное уведомление.', 400);
                target = target[part] ??= Object.create(null);
            }
        });
    }
    function arrays(value) {
        if (!value || typeof value !== 'object') return value;
        const keys = Object.keys(value);
        if (keys.length && keys.every((key, index) => key === String(index))) return keys.map((key) => arrays(value[key]));
        return Object.fromEntries(keys.map((key) => [key, arrays(value[key])]));
    }
    return arrays(root);
}
