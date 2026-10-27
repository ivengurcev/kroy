import { pool } from './client.mjs';
import { normalizeSocialLinks } from '../socialLinks.mjs';

export const EMPTY_SITE_CONTACTS = {
    address: '',
    hours: '',
    phone: '',
    latitude: null,
    longitude: null,
    socials: [],
};

function text(value, maxLength) {
    return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function coordinate(value, min, max) {
    if (value === '' || value === null || value === undefined) return null;
    const number = Number(value);
    return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

export function normalizeSiteContacts(value = {}, { strictSocials = false } = {}) {
    const source = value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : {};

    return {
        address: text(source.address, 1000),
        hours: text(source.hours, 1000),
        phone: text(source.phone, 100),
        latitude: coordinate(source.latitude, -90, 90),
        longitude: coordinate(source.longitude, -180, 180),
        socials: normalizeSocialLinks(source.socials, { strict: strictSocials }),
    };
}

function fromRow(row) {
    return row ? normalizeSiteContacts(row.contact_settings) : null;
}

export async function getSiteContacts(siteId) {
    const { rows: [row] } = await pool.query(
        'SELECT contact_settings FROM sites WHERE id = $1',
        [siteId],
    );
    return fromRow(row);
}

export async function setSiteContacts(siteId, value) {
    const contacts = normalizeSiteContacts(value, { strictSocials: true });
    const { rows: [row] } = await pool.query(
        `UPDATE sites
         SET contact_settings = $2::jsonb
         WHERE id = $1
         RETURNING contact_settings`,
        [siteId, JSON.stringify(contacts)],
    );
    if (!row) throw new Error(`Сайт ${siteId} не найден`);
    return fromRow(row);
}
