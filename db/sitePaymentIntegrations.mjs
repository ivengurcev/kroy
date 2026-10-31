import { pool } from './client.mjs';
import { PaymentSettingsError } from '../payments/providers.mjs';

function mapIntegration(row) {
    return { provider: row.provider, settings: row.settings, isActive: row.is_active };
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
        const { rows: [saved] } = await client.query(
            `INSERT INTO site_payment_integrations (site_id, provider, settings)
             VALUES ($1, $2, $3::jsonb)
             ON CONFLICT (site_id, provider) DO UPDATE SET settings = EXCLUDED.settings
             RETURNING provider, settings, is_active`,
            [siteId, provider, JSON.stringify(settings)],
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
            validateSettings(current.settings);
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
