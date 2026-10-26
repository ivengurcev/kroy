import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import styles from './SignInPage.module.css';

/**
 * Кастомная страница входа вместо стандартной страницы Auth.js `/auth/signin`.
 * Подключается через `pages: { signIn: ... }` в конфигурации auth.mjs.
 */
export default function SignInPage({ callbackUrl = '/admin', error }) {
    const [status, setStatus] = useState(error ? 'error' : 'idle');
    const formRef = useRef(null);

    useEffect(() => {
        async function loadCsrfToken() {
            try {
                const response = await fetch('/auth/csrf');
                if (!response.ok) return;
                const { csrfToken } = await response.json();
                const field = formRef.current?.elements.csrfToken;
                if (field && csrfToken) field.value = csrfToken;
            } catch {
                // CSRF-токен загрузить не удалось, ошибка появится при отправке формы.
            }
        }

        loadCsrfToken();
    }, []);

    async function handleSubmit(event) {
        event.preventDefault();
        if (status === 'submitting') return;

        setStatus('submitting');

        const formData = new FormData(event.currentTarget);
        try {
            const response = await fetch('/auth/callback/credentials', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    email: formData.get('email'),
                    password: formData.get('password'),
                    csrfToken: formData.get('csrfToken'),
                    callbackUrl,
                    json: 'true',
                }).toString(),
            });

            const data = await response.json().catch(() => ({}));

            if (response.ok && data?.ok) {
                window.location.assign(data.url || callbackUrl);
                return;
            }

            setStatus('error');
        } catch {
            setStatus('error');
        }
    }

    return (
        <main className={styles.page}>
            <form className={styles.card} ref={formRef} method="post" onSubmit={handleSubmit}>
                <h1 className={styles.title}>Вход в Oysite</h1>
                <p className={styles.subtitle}>Авторизуйтесь, чтобы управлять сайтом.</p>

                <input type="hidden" name="csrfToken" defaultValue="" />

                <label className={`${styles.field} ${styles.emailField}`}>
                    <span className={styles.label}>Email</span>
                    <input
                        className={styles.input}
                        type="email"
                        name="email"
                        autoComplete="email"
                        autoFocus
                        required
                    />
                </label>

                <label className={`${styles.field} ${styles.passwordField}`}>
                    <span className={styles.label}>Пароль</span>
                    <input
                        className={styles.input}
                        type="password"
                        name="password"
                        autoComplete="current-password"
                        required
                    />
                </label>

                {status === 'error' && (
                    <p className={styles.error} role="alert">
                        Неверный email или пароль. Попробуйте ещё раз.
                    </p>
                )}

                <button className={styles.submit} type="submit" disabled={status === 'submitting'}>
                    {status === 'submitting' ? 'Входим…' : 'Войти'}
                </button>
            </form>
        </main>
    );
}

SignInPage.propTypes = {
    callbackUrl: PropTypes.string,
    error: PropTypes.string,
};
