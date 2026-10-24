import { findUserByEmail } from './db/users.mjs';
import { verifyPassword } from './db/passwords.mjs';

async function authorize(credentials) {
    if (typeof credentials?.email !== 'string' || !credentials.email.trim()
        || typeof credentials?.password !== 'string' || !credentials.password) return null;

    const user = await findUserByEmail(credentials.email);
    if (!user || user.status !== 'active'
        || !(await verifyPassword(credentials.password, user.password_hash))) return null;

    return { id: user.id, email: user.email, is_superadmin: user.is_superadmin };
}

export async function hasAccess(authUser) {
    const identity = authUser?.session?.user ?? authUser;
    if (!identity?.id || typeof identity.email !== 'string') return false;
    const user = await findUserByEmail(identity.email);
    return user?.id === identity.id && user.status === 'active' && user.is_superadmin === true;
}

export default function auth({ AUTH_URL, CredentialsProvider }) {
    const secret = process.env.AUTH_SECRET;
    if (!secret) throw new Error('Задайте AUTH_SECRET в .env');

    return {
        secret,
        basePath: AUTH_URL,
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
