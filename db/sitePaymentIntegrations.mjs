import { pool } from './client.mjs';
import { PaymentSettingsError } from '../server/payments/providers.mjs';
import { decryptPaymentSecret, encryptPaymentSecret } from '../server/payments/secrets.mjs';

function mapIntegration(row) {
    const settings = { ...row.settings };
    if (settings.secretKey) settings.secretKey = decryptPaymentSecret(settings.secretKey);
    return { provider: row.provider, settings, isActive: row.is_active };
}

export async function getPaymentIntegrations(siteId) {
    const { rows } = await pool.query(
        'SELECT provider, settings, is_active FROM site_payment_integrations WHERE site_id = $1 ORDER BY provider',
        [siteId],
    );
    return rows.map(mapIntegration);
}

export async function savePaymentIntegration(siteId, provider, settings) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('SELECT id FROM sites WHERE id = $1 FOR UPDATE', [siteId]);
        const { rows: [current] } = await client.query('SELECT settings FROM site_payment_integrations WHERE site_id = $1 AND provider = $2', [siteId, provider]);
        const nextSettings = { ...current?.settings, ...settings };
        if (nextSettings.secretKey) nextSettings.secretKey = encryptPaymentSecret(decryptPaymentSecret(nextSettings.secretKey));
        const { rows: [saved] } = await client.query(
            `INSERT INTO site_payment_integrations (site_id, provider, settings)
             VALUES ($1, $2, $3::jsonb)
             ON CONFLICT (site_id, provider) DO UPDATE SET settings = site_payment_integrations.settings || EXCLUDED.settings
             RETURNING provider, settings, is_active`,
            [siteId, provider, JSON.stringify(nextSettings)],
        );
        await client.query('COMMIT');
        return mapIntegration(saved);
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
    } finally {
        client.release();
    }
}

export async function setPaymentIntegrationActive(siteId, provider, isActive, validateSettings) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('SELECT id FROM sites WHERE id = $1 FOR UPDATE', [siteId]);
        if (isActive) {
            const { rows: [current] } = await client.query(
                'SELECT settings FROM site_payment_integrations WHERE site_id = $1 AND provider = $2',
                [siteId, provider],
            );
            if (!current) throw new PaymentSettingsError('Сначала сохраните настройки платёжной системы.');
            const settings = validateSettings(mapIntegration({ ...current, provider }).settings);
            if (!settings.secretKey) throw new PaymentSettingsError('Сначала сохраните секретный ключ.');
            await client.query(
                'UPDATE site_payment_integrations SET is_active = FALSE WHERE site_id = $1 AND provider <> $2 AND is_active',
                [siteId, provider],
            );
        }
        await client.query(
            'UPDATE site_payment_integrations SET is_active = $3 WHERE site_id = $1 AND provider = $2',
            [siteId, provider, isActive],
        );
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
    } finally {
        client.release();
    }
}

export async function getActivePaymentIntegration(siteId) {
    const { rows: [row] } = await pool.query(
        'SELECT provider, settings, is_active FROM site_payment_integrations WHERE site_id = $1 AND is_active',
        [siteId],
    );
    return row ? mapIntegration(row) : null;
}

export async function deletePaymentSecretKey(siteId, provider) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('SELECT id FROM sites WHERE id = $1 FOR UPDATE', [siteId]);
        await client.query(
            "UPDATE site_payment_integrations SET settings = settings - 'secretKey', is_active = FALSE WHERE site_id = $1 AND provider = $2",
            [siteId, provider],
        );
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
    } finally {
        client.release();
    }
}
