import { useState } from 'react';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import FormField from '../components/ui/FormField.jsx';
import OysiteLogo from '../components/admin/OysiteLogo.svg';
import theme from '../styles/AdminTheme.module.css';
import styles from './SignInPage.module.css';

function readCallbackUrl() {
    const value = new URLSearchParams(window.location.search).get('callbackUrl');
    if (!value) return '/admin';

    try {
        const url = new URL(value, window.location.origin);
        if (url.origin !== window.location.origin || url.pathname.startsWith('/auth/')) {
            return '/admin';
        }
        return `${url.pathname}${url.search}${url.hash}`;
    } catch {
        return '/admin';
    }
}

export default function SignInPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [pending, setPending] = useState(false);

    async function handleSubmit(event) {
        event.preventDefault();
        if (pending) return;

        setPending(true);
        setError('');

        const callbackUrl = readCallbackUrl();

        try {
            const csrfResponse = await fetch('/auth/csrf', { credentials: 'same-origin' });
            if (!csrfResponse.ok) throw new Error('CSRF token request failed');
            const { csrfToken } = await csrfResponse.json();

            const response = await fetch('/auth/callback/credentials', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-Auth-Return-Redirect': '1',
                },
                body: new URLSearchParams({
                    email,
                    password,
                    csrfToken,
                    callbackUrl,
                }),
            });

            const data = await response.json().catch(() => ({}));
            const redirectUrl = data?.url ? new URL(data.url, window.location.origin) : null;
            const authError = redirectUrl?.searchParams.get('error');

            if (response.ok && redirectUrl && !authError) {
                window.location.assign(redirectUrl.href);
                return;
            }

            setError('Неверный email или пароль. Попробуйте ещё раз.');
        } catch {
            setError('Не удалось войти. Попробуйте ещё раз.');
        } finally {
            setPending(false);
        }
    }

    return (
        <main className={`${theme.theme} ${styles.page}`}>
            <Card className={styles.window}>
                <div className={styles.logo} role="img" aria-label="Oysite">
                    <OysiteLogo aria-hidden="true" />
                </div>
                <p className={styles.subtitle}>Авторизуйтесь, чтобы управлять сайтом.</p>

                <form className={styles.form} onSubmit={handleSubmit}>
                    <FormField label="Email">
                        <input
                            className={styles.input}
                            type="email"
                            name="email"
                            autoComplete="email"
                            autoFocus
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            required
                        />
                    </FormField>

                    <FormField label="Пароль">
                        <input
                            className={styles.input}
                            type="password"
                            name="password"
                            autoComplete="current-password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            required
                        />
                    </FormField>

                    {error && (
                        <p className={styles.error} role="alert">{error}</p>
                    )}

                    <Button className={styles.submit} variant="primary" type="submit" disabled={pending}>
                        {pending ? 'Входим…' : 'Войти'}
                    </Button>
                </form>
            </Card>
        </main>
    );
}
