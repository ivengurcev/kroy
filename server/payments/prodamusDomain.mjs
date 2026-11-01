export function normalizePayformDomain(value) {
    const domain = typeof value === 'string' ? value.trim().toLowerCase().replace(/^https:\/\//, '').replace(/\/$/, '') : '';
    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.payform\.ru$/.test(domain)) {
        throw new TypeError('Укажите домен платёжной формы вида example.payform.ru.');
    }
    return domain;
}

export function validatePaymentLink(value, formDomain) {
    if (typeof value !== 'string' || value.length > 4096 || /[\s\\]/.test(value)) throw new TypeError('Invalid payment link');
    const match = value.match(/^https:\/\/([^/?#]+)(?:[/?#]|$)/i);
    const url = new URL(value);
    if (!match || match[1].toLowerCase() !== url.hostname || url.username || url.password || url.port || url.hash
        || ![normalizePayformDomain(formDomain), 'payform.ru'].includes(url.hostname)
        || [...url.searchParams.keys()].some((key) => key.toLowerCase() === 'signature')) {
        throw new TypeError('Invalid payment link');
    }
    return url.href;
}
