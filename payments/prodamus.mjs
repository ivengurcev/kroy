import { createHmac } from 'node:crypto';
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

export async function createProdamusPaymentLink(product, settings, sys) {
    if (typeof settings.secretKey !== 'string' || !settings.secretKey.trim() || typeof sys !== 'string' || !sys.trim()) {
        throw new PaymentError('Оплата временно недоступна.', 503);
    }
    let domain;
    try { domain = normalizePayformDomain(settings.payformDomain); }
    catch { throw new PaymentError('Оплата временно недоступна.', 503); }
    const data = {
        do: 'link', sys, currency: 'rub',
        products: [{ name: product.name, price: product.price, quantity: 1, sku: product.id, type: product.type }],
    };
    const signature = signProdamusRequest(data, settings.secretKey);
    const body = new URLSearchParams({ do: data.do, sys: data.sys, currency: data.currency });
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
