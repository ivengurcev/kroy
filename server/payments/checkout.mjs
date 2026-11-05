import { getActivePaymentIntegration } from '../../db/sitePaymentIntegrations.mjs';
import { createOrder } from '../../db/orders.mjs';
import { getPaymentProvider } from './providers.mjs';
import { createProdamusPaymentLink } from './prodamus.mjs';
import PaymentError from './paymentError.mjs';

export function isPaymentConfigured(integration) {
    if (!integration?.isActive || integration.provider !== 'prodamus') return false;
    try {
        return Boolean(getPaymentProvider(integration.provider).normalizeSettings(integration.settings).secretKey);
    } catch { return false; }
}

export async function paymentAvailable(siteId) {
    return isPaymentConfigured(await getActivePaymentIntegration(siteId));
}

export async function startPayment(siteId, productId, origin) {
    const integration = await getActivePaymentIntegration(siteId);
    if (!isPaymentConfigured(integration)) throw new PaymentError('Оплата временно недоступна.', 503);
    const settings = getPaymentProvider(integration.provider).normalizeSettings(integration.settings);
    const order = await createOrder(siteId, productId, { ...integration, settings }, origin);
    return createProdamusPaymentLink(order.product, settings, process.env.PRODAMUS_SYS, {
        id: order.id, returnUrl: `${origin}/?oysite_order=${order.token}`,
    });
}
