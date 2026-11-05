import { pool } from '../db/client.mjs';
import { savePaymentIntegration } from '../db/sitePaymentIntegrations.mjs';
import { encryptPaymentSecret } from '../server/payments/secrets.mjs';

try {
    const apply = process.argv.includes('--apply');
    const { rows } = await pool.query(`SELECT site_id, provider FROM site_payment_integrations
        WHERE settings->>'secretKey' IS NOT NULL AND settings->>'secretKey' NOT LIKE 'encrypted:v1:%'`);
    if (apply) {
        encryptPaymentSecret('preflight');
        for (const row of rows) await savePaymentIntegration(row.site_id, row.provider, {});
    }
    console.log(`${apply ? 'Зашифровано ключей' : 'Ключей для шифрования (dry-run)'}: ${rows.length}`);
    if (!apply && rows.length) console.log('Для применения: bun scripts/encryptPaymentSecrets.mjs --apply');
} catch {
    console.error('Не удалось зашифровать ключи. Проверьте подключение к БД и PAYMENT_ENCRYPTION_KEY (либо AUTH_SECRET).');
    process.exitCode = 1;
} finally { await pool.end(); }
