import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';

const PREFIX = 'encrypted:v1:';

function encryptionKey() {
    const secret = process.env.PAYMENT_ENCRYPTION_KEY || process.env.AUTH_SECRET;
    if (!secret || secret.length < 32) throw new Error('Payment encryption key is not configured');
    return Buffer.from(hkdfSync('sha256', secret, 'oysite', 'payment-secrets-v1', 32));
}

export function encryptPaymentSecret(value) {
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', encryptionKey(), nonce);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return PREFIX + Buffer.concat([nonce, cipher.getAuthTag(), encrypted]).toString('base64');
}

export function decryptPaymentSecret(value) {
    // Compatibility with existing integrations; re-saving settings encrypts legacy keys.
    if (!value?.startsWith(PREFIX)) return value;
    const data = Buffer.from(value.slice(PREFIX.length), 'base64');
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), data.subarray(0, 12));
    decipher.setAuthTag(data.subarray(12, 28));
    return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString('utf8');
}
