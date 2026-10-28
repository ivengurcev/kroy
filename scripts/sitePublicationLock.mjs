import { pool } from '../db/client.mjs';

export const SITE_PUBLICATION_LOCK = 'kroy:site-publication';

export async function acquireSitePublicationLock() {
    const client = await pool.connect();
    let released = false;
    try {
        const { rows: [{ acquired }] } = await client.query(
            'SELECT pg_try_advisory_lock(hashtext($1)) AS acquired',
            [SITE_PUBLICATION_LOCK],
        );
        if (!acquired) {
            client.release();
            released = true;
            throw new Error('Уже выполняется публикация или откат. Попробуйте позже.');
        }
        return client;
    } catch (error) {
        if (!released) client.release();
        throw error;
    }
}

export async function releaseSitePublicationLock(client) {
    if (!client) return;
    await client.query(
        'SELECT pg_advisory_unlock(hashtext($1))',
        [SITE_PUBLICATION_LOCK],
    ).catch(() => {});
    client.release();
}
