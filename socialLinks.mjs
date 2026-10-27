export const SOCIAL_TYPES = [
    { value: 'telegram', label: 'Telegram' },
    { value: 'instagram', label: 'Instagram' },
    { value: 'max', label: 'MAX' },
    { value: 'vk', label: 'ВКонтакте' },
    { value: 'youtube', label: 'YouTube' },
    { value: 'tiktok', label: 'TikTok' },
    { value: 'other', label: 'Другое' },
];

const SERVICES = {
    telegram: { hosts: ['t.me', 'telegram.me'], prefix: 'https://t.me/' },
    instagram: { hosts: ['instagram.com', 'www.instagram.com'], prefix: 'https://instagram.com/' },
    vk: { hosts: ['vk.com', 'www.vk.com'], prefix: 'https://vk.com/' },
    youtube: { hosts: ['youtube.com', 'www.youtube.com'], prefix: 'https://youtube.com/@' },
    tiktok: { hosts: ['tiktok.com', 'www.tiktok.com'], prefix: 'https://www.tiktok.com/@' },
};

const TYPE_ALIASES = {
    telegram: 'telegram',
    instagram: 'instagram',
    max: 'max',
    vk: 'vk',
    'вконтакте': 'vk',
    youtube: 'youtube',
    tiktok: 'tiktok',
    other: 'other',
    другое: 'other',
};

function text(value, maxLength = 500) {
    return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function parseHttpsUrl(value) {
    try {
        const url = new URL(value);
        return url.protocol === 'https:' ? url : null;
    } catch {
        return null;
    }
}

function serviceFromUrl(value) {
    const url = parseHttpsUrl(value);
    if (!url) return null;
    const hostname = url.hostname.toLowerCase();
    return Object.entries(SERVICES).find(([, service]) => service.hosts.includes(hostname))?.[0] ?? null;
}

export function normalizeSocialType(value) {
    return TYPE_ALIASES[text(value, 40).toLocaleLowerCase()] ?? 'other';
}

export function socialType(social = {}) {
    return normalizeSocialType(social.type) === 'other' && !social.type
        ? serviceFromUrl(social.link) ?? normalizeSocialType(social.name)
        : normalizeSocialType(social.type);
}

function nicknameFromValue(type, value) {
    const input = text(value, 500);
    if (!input) return '';

    const url = parseHttpsUrl(input);
    if (!url) return input.replace(/^@+/, '').replace(/^\/+|\/+$/g, '');

    const service = SERVICES[type];
    if (!service || !service.hosts.includes(url.hostname.toLowerCase())) return '';
    const path = url.pathname.split('/').filter(Boolean);
    if (!path.length) return '';
    if (type === 'youtube' && path[0].startsWith('@')) return path[0].slice(1);
    return path[0].replace(/^@+/, '');
}

export function buildSocialLink(type, value) {
    const normalizedType = normalizeSocialType(type);
    if (normalizedType === 'other' || normalizedType === 'max') {
        const url = parseHttpsUrl(text(value));
        return url?.href ?? '';
    }

    const inputUrl = parseHttpsUrl(text(value));
    if (inputUrl && SERVICES[normalizedType].hosts.includes(inputUrl.hostname.toLowerCase())) {
        return inputUrl.href;
    }

    const nickname = nicknameFromValue(normalizedType, value);
    if (!nickname || !/^[\p{L}\p{N}._-]+$/u.test(nickname)) return '';
    const encoded = encodeURIComponent(nickname);
    return normalizedType === 'youtube' || normalizedType === 'tiktok'
        ? `${SERVICES[normalizedType].prefix}${encoded}`
        : `${SERVICES[normalizedType].prefix}${encoded}`;
}

export function socialLabel(type) {
    return SOCIAL_TYPES.find((item) => item.value === normalizeSocialType(type))?.label ?? 'Другое';
}

export function normalizeSocialLink(value, { strict = false } = {}) {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const type = socialType(source);
    const sourceValue = text(source.value || source.link, 500);
    const name = text(source.name, 80) || socialLabel(type);
    const link = buildSocialLink(type, sourceValue);

    if (!sourceValue) return null;
    if (!link) {
        if (strict) throw new Error(`Укажите корректную HTTPS-ссылку для «${name}».`);
        return { type, value: sourceValue, name, link: source.link || '' };
    }

    return {
        type,
        value: type === 'other' || type === 'max' ? link : nicknameFromValue(type, sourceValue),
        name,
        link,
    };
}

export function normalizeSocialLinks(value, options) {
    if (!Array.isArray(value)) return [];
    return value.slice(0, 50)
        .map((item) => normalizeSocialLink(item, options))
        .filter((item) => item?.link);
}
