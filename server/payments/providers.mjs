import { normalizePayformDomain } from './prodamusDomain.mjs';

export class PaymentSettingsError extends Error {}

function normalizeProdamusSettings(settings) {
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)
        || !Object.hasOwn(settings, 'payformDomain')
        || Object.keys(settings).some((key) => !['payformDomain', 'secretKey', 'testMode'].includes(key))) {
        throw new PaymentSettingsError('Укажите адрес платёжной формы Prodamus.');
    }
    let payformDomain;
    try { payformDomain = normalizePayformDomain(settings.payformDomain); }
    catch { throw new PaymentSettingsError('Укажите домен платёжной формы вида example.payform.ru.'); }
    if (settings.secretKey !== undefined && (typeof settings.secretKey !== 'string' || settings.secretKey.length > 4096)) {
        throw new PaymentSettingsError('Некорректный секретный ключ.');
    }
    const secretKey = settings.secretKey?.trim();
    if (settings.testMode !== undefined && typeof settings.testMode !== 'boolean') throw new PaymentSettingsError('Некорректный режим оплаты.');
    return { payformDomain, ...(secretKey ? { secretKey } : {}), ...(settings.testMode !== undefined ? { testMode: settings.testMode } : {}) };
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
            secretKey: { label: 'Секретный ключ', type: 'password', required: false, default: '', readable: false },
            testMode: { label: 'Тестовый режим (demo_mode)', type: 'checkbox', default: false, readable: true },
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
        fields[name] = { label: field.label, type: field.type, required: field.required, placeholder: field.placeholder,
            ...(field.readable === true ? {} : { configured: Boolean(integration?.settings?.[name]) }),
        };
        // New settings remain server-side unless explicitly allowed in the admin response.
        if (field.readable === true) settings[name] = integration?.settings?.[name] ?? field.default;
    }
    return {
        provider: provider.id, name: provider.name, currency: provider.currency,
        fields, settings, isActive: integration?.isActive ?? false,
    };
}
