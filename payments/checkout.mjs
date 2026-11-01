import { getActivePaymentIntegration } from '../db/sitePaymentIntegrations.mjs';
import { getProductForPayment } from '../db/catalog.mjs';
import { getPaymentProvider } from './providers.mjs';
import { createProdamusPaymentLink } from './prodamus.mjs';
import PaymentError from './paymentError.mjs';

export function isPaymentConfigured(integration, sys = process.env.PRODAMUS_SYS) {
    if (!integration?.isActive || integration.provider !== 'prodamus' || typeof sys !== 'string' || !sys.trim()) return false;
    try {
        return Boolean(getPaymentProvider(integration.provider).normalizeSettings(integration.settings).secretKey);
    } catch { return false; }
}

export async function paymentAvailable(siteId) {
    return isPaymentConfigured(await getActivePaymentIntegration(siteId));
}

export async function startPayment(siteId, productId) {
    const product = await getProductForPayment(siteId, productId);
    if (!product) throw new PaymentError('Позиция недоступна для оплаты.', 404);
    if (typeof product.price !== 'string' || !/^\d{1,10}\.\d{2}$/.test(product.price) || /^0+\.00$/.test(product.price)
        || !['service', 'goods'].includes(product.type) || typeof product.name !== 'string' || !product.name.trim()) {
        throw new PaymentError('Позиция недоступна для оплаты.', 400);
    }
    const integration = await getActivePaymentIntegration(siteId);
    if (!isPaymentConfigured(integration)) throw new PaymentError('Оплата временно недоступна.', 503);
    const settings = getPaymentProvider(integration.provider).normalizeSettings(integration.settings);
    return createProdamusPaymentLink(product, settings, process.env.PRODAMUS_SYS.trim());
}
