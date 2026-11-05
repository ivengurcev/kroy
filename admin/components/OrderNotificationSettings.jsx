import { useEffect, useState } from 'react';
import Button from '../ui/Button.jsx';
import compactStyles from '../ui/CompactForm.module.css';

export default function OrderNotificationSettings() {
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

    async function save(event) {
        event.preventDefault();
        if (busy) return;
        setBusy(true); setMessage('');
        try {
            const response = await fetch('/api/site/order-notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim() }) });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Не удалось сохранить email.');
            setSettings(result); setEmail(result.email || ''); setMessage('Адрес уведомлений сохранён.');
        } catch (error) { setMessage(error.message); }
        finally { setBusy(false); }
    }

    return <form onSubmit={save}>
        <h2>Уведомления о заказах</h2>
        <label className={`${compactStyles.field} ${compactStyles.compact}`}><span>Email для уведомлений</span>
            <input type="email" maxLength={320} value={email} disabled={!settings || busy} placeholder={settings?.defaultEmail || 'Укажите email получателя'} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <p>{settings?.defaultEmail ? `Если поле пустое, используется email администратора сайта: ${settings.defaultEmail}.` : 'У сайта нет единственного администратора. Укажите адрес получателя явно.'}</p>
        <p>Почтовый транспорт пока не подключён. Уведомления сохраняются в очереди, заказы и платежи работают независимо от отправки писем.</p>
        <Button type="submit" disabled={!settings || busy || email === (settings.email || '')}>{busy ? 'Сохранение…' : 'Сохранить email'}</Button>
        {message && <p role="status">{message}</p>}
    </form>;
}
