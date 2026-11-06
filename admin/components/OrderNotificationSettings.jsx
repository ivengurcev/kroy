import { useEffect, useState } from 'react';
import compactStyles from '../ui/CompactForm.module.css';
import { formResponseError } from '../ui/formValidation.mjs';

export function useOrderNotificationSettings() {
    const [settings, setSettings] = useState(null);
    const [email, setEmail] = useState('');
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    useEffect(() => {
        const controller = new AbortController();
        fetch('/api/site/order-notifications', { signal: controller.signal }).then(async (response) => {
            if (!response.ok) throw new Error('Не удалось загрузить адрес уведомлений.');
            return response.json();
        }).then((result) => { setSettings(result); setEmail(result.email || ''); })
            .catch((error) => { if (error.name !== 'AbortError') setMessage(error.message); });
        return () => controller.abort();
    }, []);

    const dirty = Boolean(settings && email !== (settings.email || ''));
    async function save(form) {
        if (busy || !dirty) return;
        setBusy(true); setMessage('');
        try {
            const response = await fetch('/api/site/order-notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim() }) });
            if (!response.ok) throw new Error(await formResponseError(response, form, 'Не удалось сохранить email. Повторите попытку.'));
            const result = await response.json();
            setSettings(result); setEmail(result.email || ''); setMessage('Адрес уведомлений сохранён.');
        } catch (error) { setMessage('Не удалось сохранить email. Проверьте адрес и повторите попытку.'); throw error; }
        finally { setBusy(false); }
    }

    return { settings, email, setEmail(value) { setEmail(value); setMessage(''); }, busy, message, dirty, save };
}

export default function OrderNotificationSettings({ state, disabled = false }) {
    const { settings, email, setEmail, busy, message } = state;
    return <div>
        <h2>Уведомления о заказах</h2>
        <label className={`${compactStyles.field} ${compactStyles.compact}`}><span>Email для уведомлений</span>
            <input name="email" type="email" maxLength={320} value={email} disabled={!settings || busy || disabled} placeholder={settings?.defaultEmail || 'Укажите email получателя'} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <p>{settings?.defaultEmail ? `Если поле пустое, используется email администратора сайта: ${settings.defaultEmail}.` : 'У сайта нет единственного администратора. Укажите адрес получателя явно.'}</p>
        <p>Почтовый транспорт пока не подключён. Уведомления сохраняются в очереди, заказы и платежи работают независимо от отправки писем.</p>
        {message && <p role="status">{message}</p>}
    </div>;
}
