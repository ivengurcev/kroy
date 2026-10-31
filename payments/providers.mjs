export class PaymentSettingsError extends Error {}

function normalizeProdamusSettings(settings) {
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)
        || Object.keys(settings).length !== 1 || !Object.hasOwn(settings, 'payformDomain')
        || typeof settings.payformDomain !== 'string') {
        throw new PaymentSettingsError('Укажите адрес платёжной формы Prodamus.');
    }
    const domain = settings.payformDomain.trim().toLowerCase().replace(/^https:\/\//, '').replace(/\/$/, '');
    const labels = domain.split('.');
    if (domain.length > 253 || labels.length < 2 || !/^[a-z]{2,63}$/.test(labels.at(-1))
        || labels.some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) {
        throw new PaymentSettingsError('Укажите домен платёжной формы без пути и параметров, например example.payform.ru.');
    }
    return { payformDomain: domain };
}

export const paymentProviders = {
    prodamus: {
        id: 'prodamus',
        name: 'Prodamus',
        currency: 'RUB',
        fields: {
            payformDomain: {
                label: 'Адрес платёжной формы', type: 'text', required: true,
                default: '', placeholder: 'example.payform.ru', readable: true,
            },
        },
        normalizeSettings: normalizeProdamusSettings,
    },
};

export function getPaymentProvider(id) {
    if (typeof id !== 'string' || !Object.hasOwn(paymentProviders, id)) {
        throw new PaymentSettingsError('Неизвестная платёжная система.');
    }
    return paymentProviders[id];
}

export function describePaymentProvider(provider, integration) {
    const fields = {};
    const settings = {};
    for (const [name, field] of Object.entries(provider.fields)) {
        fields[name] = { label: field.label, type: field.type, required: field.required, placeholder: field.placeholder };
        // New settings remain server-side unless explicitly allowed in the admin response.
        if (field.readable === true) settings[name] = integration?.settings?.[name] ?? field.default;
    }
    return {
        provider: provider.id, name: provider.name, currency: provider.currency,
        fields, settings, isActive: integration?.isActive ?? false,
    };
}
