import getCurrentSite from './siteContext.mjs';
import isUuid from './isUuid.mjs';
import { isPlainObject } from '../../shared/pageFields.mjs';
import { applyProdamusPayment, completeOrder, getOrder, getPublicOrder, listOrders, getOrderNotificationSettings, saveOrderNotificationSettings } from '../../db/orders.mjs';
import { getPaymentIntegrations } from '../../db/sitePaymentIntegrations.mjs';
import { parseProdamusForm } from '../payments/prodamus.mjs';
import { normalizeWebhook } from '../payments/webhook.mjs';
import PaymentError from '../payments/paymentError.mjs';
import { dispatchOrderNotifications } from '../notifications/orders.mjs';

const NO_STORE = { 'Cache-Control': 'no-store' };

function failure(c, error) {
    if (error instanceof PaymentError) return c.json({ error: error.message }, error.status, NO_STORE);
    return c.json({ error: 'Не удалось обработать заказ.' }, 500, NO_STORE);
}

export async function getSiteOrders(c) {
    const status = c.req.query('status') || '';
    const offset = Number(c.req.query('offset') || 0);
    if (!['', 'pending', 'paid', 'completed'].includes(status) || !Number.isSafeInteger(offset) || offset < 0 || offset > 1_000_000) return c.json({ error: 'Некорректный фильтр.' }, 400);
    try {
        const site = await getCurrentSite(c);
        if (!site) return c.json({ error: 'Сайт не найден.' }, 404);
        return c.json(await listOrders(site.id, status, offset), 200, NO_STORE);
    } catch (error) { return failure(c, error); }
}

export async function getSiteOrder(c) {
    if (!isUuid(c.req.param('id'))) return c.json({ error: 'Заказ не найден.' }, 404);
    try {
        const site = await getCurrentSite(c);
        const order = site && await getOrder(site.id, c.req.param('id'));
        return order ? c.json(order, 200, NO_STORE) : c.json({ error: 'Заказ не найден.' }, 404);
    } catch (error) { return failure(c, error); }
}

export async function postCompleteOrder(c) {
    if (!isUuid(c.req.param('id'))) return c.json({ error: 'Заказ не найден.' }, 404);
    try {
        const site = await getCurrentSite(c);
        if (!site) return c.json({ error: 'Сайт не найден.' }, 404);
        if (!await completeOrder(site.id, c.req.param('id'))) return c.json({ error: 'Можно завершить только оплаченный заказ текущего сайта.' }, 409);
        return c.json(await getOrder(site.id, c.req.param('id')), 200, NO_STORE);
    } catch (error) { return failure(c, error); }
}

export async function getPublicOrderStatus(c) {
    const token = c.req.param('token');
    if (!/^[a-f0-9]{64}$/.test(token)) return c.json({ error: 'Заказ не найден.' }, 404, NO_STORE);
    try {
        const site = await getCurrentSite(c);
        const order = site && await getPublicOrder(site.id, token);
        return order ? c.json(order, 200, NO_STORE) : c.json({ error: 'Заказ не найден.' }, 404, NO_STORE);
    } catch (error) { return failure(c, error); }
}

export async function postProdamusWebhook(c) {
    try {
        if (Number(c.req.header('content-length')) > 65536) return c.text('Payload too large', 413);
        const reader = c.req.raw.body?.getReader();
        if (!reader) return c.text('Empty payload', 400);
        const chunks = [];
        let size = 0;
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                size += value.length;
                if (size > 65536) { await reader.cancel(); return c.text('Payload too large', 413); }
                chunks.push(value);
            }
        } finally { reader.releaseLock(); }
        const bytes = Buffer.concat(chunks);
        const body = bytes.toString('utf8');
        const type = c.req.header('content-type')?.split(';')[0];
        let data;
        if (type === 'application/json') data = JSON.parse(body);
        else if (type === 'application/x-www-form-urlencoded') data = parseProdamusForm(body);
        else if (type === 'multipart/form-data') {
            let form;
            try { form = await new Response(bytes, { headers: { 'Content-Type': c.req.header('content-type') } }).formData(); }
            catch { return c.text('Invalid payload', 400); }
            const params = new URLSearchParams();
            for (const [key, value] of form) {
                if (typeof value !== 'string') return c.text('Files are not accepted', 400);
                params.append(key, value);
            }
            data = parseProdamusForm(params.toString());
        }
        if (!isPlainObject(data)) return c.text('Invalid payload', 400);
        const site = await getCurrentSite(c);
        if (!site) return c.text('Site not found', 404);
        // Disabled checkout must still accept outstanding payment confirmations.
        const integration = (await getPaymentIntegrations(site.id)).find((item) => item.provider === 'prodamus');
        if (!integration?.settings.secretKey) return c.text('Integration not configured', 400);
        const event = normalizeWebhook(data, integration.settings, c.req.header('Sign'));
        await applyProdamusPayment(site.id, event);
        void dispatchOrderNotifications().catch(() => {});
        return c.text('success', 200, NO_STORE);
    } catch (error) {
        if (error instanceof SyntaxError) return c.text('Invalid payload', 400);
        return failure(c, error);
    }
}

export async function getOrderNotifications(c) {
    try {
        const site = await getCurrentSite(c);
        if (!site) return c.json({ error: 'Сайт не найден.' }, 404);
        return c.json(await getOrderNotificationSettings(site.id), 200, NO_STORE);
    } catch (error) { return failure(c, error); }
}

export async function patchOrderNotifications(c) {
    const body = await c.req.json().catch(() => null);
    if (!isPlainObject(body) || Object.keys(body).length !== 1 || typeof body.email !== 'string'
        || body.email.length > 320 || body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) return c.json({ error: 'Укажите корректный email.' }, 400);
    try {
        const site = await getCurrentSite(c);
        if (!site) return c.json({ error: 'Сайт не найден.' }, 404);
        await saveOrderNotificationSettings(site.id, body.email);
        return c.json(await getOrderNotificationSettings(site.id), 200, NO_STORE);
    } catch (error) { return failure(c, error); }
}
