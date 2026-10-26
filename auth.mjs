import { findUserByEmail } from './db/users.mjs';
import { verifyPassword } from './db/passwords.mjs';
import { pool } from './db/client.mjs';
import getHostname from './api/getHostname.mjs';

async function authorize(credentials) {
    if (typeof credentials?.email !== 'string' || !credentials.email.trim()
        || typeof credentials?.password !== 'string' || !credentials.password) return null;

    const user = await findUserByEmail(credentials.email);
    if (!user || user.status !== 'active'
        || !(await verifyPassword(credentials.password, user.password_hash))) return null;

    return { id: user.id, email: user.email, is_superadmin: user.is_superadmin };
}

export async function hasAccess(authUser, requirements, c) {
    const identity = authUser?.session?.user ?? authUser?.user ?? authUser?.token ?? authUser;
    if (!identity?.id || typeof identity.email !== 'string') return false;
    const { rows: [user] } = await pool.query(
        `SELECT id, email, status, is_superadmin
         FROM users
         WHERE id = $1 AND lower(email) = lower($2)`,
        [identity.id, identity.email],
    );
    if (!user || user.status !== 'active') return false;
    if (user.is_superadmin) return true;

    const hostname = c && getHostname(c);
    if (!hostname) return false;
    const { rowCount } = await pool.query(
        `SELECT 1
         FROM site_memberships sm
         JOIN domains d ON d.site_id = sm.site_id
         WHERE sm.user_id = $1 AND sm.role = 'admin' AND d.hostname = $2`,
        [user.id, hostname],
    );
    return rowCount > 0;
}

export default function auth({ AUTH_URL, CredentialsProvider }) {
    const secret = process.env.AUTH_SECRET;
    if (!secret) throw new Error('Задайте AUTH_SECRET в .env');

    return {
        secret,
        basePath: AUTH_URL,
        // Кастомная страница входа (pages/SignInPage.jsx) вместо стандартной Auth.js.
        pages: { signIn: '/auth/signin' },
        session: { strategy: 'jwt' },
        providers: [CredentialsProvider({
            credentials: {
                email: { label: 'Email', type: 'email' },
                password: { label: 'Пароль', type: 'password' },
            },
            authorize,
        })],
        callbacks: {
            jwt({ token, user }) {
                if (user) {
                    token.id = user.id;
                    token.email = user.email;
                    token.is_superadmin = user.is_superadmin;
                }
                return token;
            },
            session({ session, token }) {
                session.user = {
                    id: token.id,
                    email: token.email,
                    is_superadmin: token.is_superadmin === true,
                };
                return session;
            },
        },
        logger: {
            error(error) { console.error('Ошибка авторизации Auth.js:', error.type ?? 'Unknown'); },
            warn(code) { console.warn('Предупреждение конфигурации Auth.js:', code); },
            debug() {},
        },
    };
}
