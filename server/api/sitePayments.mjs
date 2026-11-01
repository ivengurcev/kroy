import getCurrentSite from './siteContext.mjs';
import { isPlainObject } from '../../shared/pageFields.mjs';
import { getPaymentIntegrations, savePaymentIntegration, setPaymentIntegrationActive, deletePaymentSecretKey } from '../../db/sitePaymentIntegrations.mjs';
import { paymentProviders, getPaymentProvider, describePaymentProvider, PaymentSettingsError } from '../payments/providers.mjs';

async function sitePayments(siteId) {
    const integrations = await getPaymentIntegrations(siteId);
    return { providers: Object.values(paymentProviders).map((provider) => describePaymentProvider(
        provider, integrations.find((integration) => integration.provider === provider.id),
    )) };
}

function paymentError(c, error) {
    if (error instanceof PaymentSettingsError) return c.json({ error: error.message }, 400);
    console.error('Failed to update site payments');
    return c.json({ error: 'Internal server error' }, 500);
}

export async function getSitePayments(c) {
    try {
        const site = await getCurrentSite(c);
        if (!site) return c.json({ error: 'Site not found' }, 404);
        return c.json(await sitePayments(site.id));
    } catch (error) {
        return paymentError(c, error);
    }
}

export async function patchSitePaymentSettings(c) {
    const body = await c.req.json().catch(() => null);
    if (!isPlainObject(body) || Object.keys(body).length !== 1 || !Object.hasOwn(body, 'settings')) {
        return c.json({ error: 'Invalid payment settings' }, 400);
    }
    try {
        const provider = getPaymentProvider(c.req.param('provider'));
        const settings = provider.normalizeSettings(body.settings);
        const site = await getCurrentSite(c);
        if (!site) return c.json({ error: 'Site not found' }, 404);
        await savePaymentIntegration(site.id, provider.id, settings);
        return c.json(await sitePayments(site.id));
    } catch (error) {
        return paymentError(c, error);
    }
}

export async function patchSitePaymentActivation(c) {
    const body = await c.req.json().catch(() => null);
    if (!isPlainObject(body) || Object.keys(body).length !== 1 || typeof body.isActive !== 'boolean') {
        return c.json({ error: 'Invalid activation settings' }, 400);
    }
    try {
        const provider = getPaymentProvider(c.req.param('provider'));
        const site = await getCurrentSite(c);
        if (!site) return c.json({ error: 'Site not found' }, 404);
        await setPaymentIntegrationActive(site.id, provider.id, body.isActive, provider.normalizeSettings);
        return c.json(await sitePayments(site.id));
    } catch (error) {
        return paymentError(c, error);
    }
}

export async function deleteSitePaymentSecretKey(c) {
    try {
        const provider = getPaymentProvider(c.req.param('provider'));
        const site = await getCurrentSite(c);
        if (!site) return c.json({ error: 'Site not found' }, 404);
        await deletePaymentSecretKey(site.id, provider.id);
        return c.json(await sitePayments(site.id));
    } catch (error) {
        return paymentError(c, error);
    }
}
