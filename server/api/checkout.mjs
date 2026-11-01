import getCurrentSite from './siteContext.mjs';
import { isPlainObject } from '../../shared/pageFields.mjs';
import isUuid from './isUuid.mjs';
import { paymentAvailable, startPayment } from '../payments/checkout.mjs';
import PaymentError from '../payments/paymentError.mjs';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function getPaymentStatus(c) {
    try {
        const site = await getCurrentSite(c);
        if (!site) return c.json({ enabled: false }, 404, NO_STORE);
        return c.json({ enabled: await paymentAvailable(site.id) }, 200, NO_STORE);
    } catch {
        return c.json({ enabled: false }, 500, NO_STORE);
    }
}

export async function postPaymentStart(c) {
    const body = await c.req.json().catch(() => null);
    if (!isPlainObject(body) || Object.keys(body).length !== 1 || !isUuid(body.productId)) {
        return c.json({ error: 'Некорректная позиция каталога.' }, 400, NO_STORE);
    }
    try {
        const site = await getCurrentSite(c);
        if (!site) return c.json({ error: 'Сайт не найден.' }, 404, NO_STORE);
        return c.json({ url: await startPayment(site.id, body.productId) }, 200, NO_STORE);
    } catch (error) {
        if (error instanceof PaymentError) return c.json({ error: error.message }, error.status, NO_STORE);
        // Do not log upstream errors: they can contain signed request data or merchant secrets.
        console.error('Failed to start checkout');
        return c.json({ error: 'Не удалось начать оплату. Попробуйте позже.' }, 500, NO_STORE);
    }
}
