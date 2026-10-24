import { pool } from '../db/client.mjs';

const [slug, email] = process.argv.slice(2);
const normalizedEmail = email?.trim().toLowerCase();

try {
    if (!slug || !normalizedEmail) {
        throw new Error('Использование: yarn site:user:add <slug> <email>');
    }
    const { rows: [site] } = await pool.query('SELECT id FROM sites WHERE slug = $1', [slug]);
    if (!site) throw new Error(`Сайт со slug ${slug} не найден`);
    const { rows: [user] } = await pool.query(
        'SELECT id, email FROM users WHERE lower(email) = $1',
        [normalizedEmail],
    );
    if (!user) throw new Error(`Пользователь ${normalizedEmail} не найден`);
    await pool.query(
        `INSERT INTO site_memberships (site_id, user_id, role)
         VALUES ($1, $2, 'admin')
         ON CONFLICT (site_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
        [site.id, user.id],
    );
    console.log(`Пользователь ${user.email} назначен администратором сайта ${slug}`);
} catch (error) {
    console.error(`Не удалось назначить пользователя: ${error.message}`);
    process.exitCode = 1;
} finally {
    await pool.end();
}
