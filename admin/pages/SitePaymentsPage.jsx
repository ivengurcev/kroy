import { useEffect, useState } from 'react';
import SiteSettingsLayout from '../components/SiteSettingsLayout.jsx';
import PaymentIntegrationEditor from '../components/PaymentIntegrationEditor.jsx';
import OrderNotificationSettings, { useOrderNotificationSettings } from '../components/OrderNotificationSettings.jsx';
import AdminPanel from '../ui/AdminPanel.jsx';
import Button from '../ui/Button.jsx';
import compactStyles from '../ui/CompactForm.module.css';
import styles from './SitePaymentsPage.module.css';
import { apiRequest } from '../editor/apiRequest.mjs';
import { formResponseError } from '../ui/formValidation.mjs';

async function readPayments(response, form) {
    if (!response.ok) throw new Error(await formResponseError(response, form, 'Не удалось сохранить или загрузить платёжные настройки. Проверьте поля и повторите попытку.'));
    const result = await response.json().catch(() => ({}));
    return result.providers;
}

export default function SitePaymentsPage() {
    const [providers, setProviders] = useState([]);
    const [selected, setSelected] = useState('');
    const [draft, setDraft] = useState({});
    const [status, setStatus] = useState('loading');
    const [saveStatus, setSaveStatus] = useState('idle');
    const [action, setAction] = useState(null);
    const [error, setError] = useState('');
    const [webhookUrl, setWebhookUrl] = useState('');
    const notifications = useOrderNotificationSettings();
    const provider = providers.find((item) => item.provider === selected);
    const active = providers.find((item) => item.isActive);
    const dirty = Boolean(provider && JSON.stringify(draft) !== JSON.stringify(provider.settings));

    useEffect(() => {
        setWebhookUrl(`${window.location.origin}/api/payments/prodamus/webhook`);
        const controller = new AbortController();
        fetch('/api/site/payments', { signal: controller.signal })
            .then(readPayments)
            .then((result) => {
                setProviders(result);
                setSelected(result[0]?.provider ?? '');
                setDraft(result[0]?.settings ?? {});
                setStatus('success');
            })
            .catch((loadError) => {
                if (loadError.name !== 'AbortError') { setError(loadError.message); setStatus('error'); }
            });
        return () => controller.abort();
    }, []);

    useEffect(() => {
        if (!dirty) return undefined;
        const warn = (event) => { event.preventDefault(); event.returnValue = ''; };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [dirty]);

    function selectProvider(name) {
        if (dirty && !window.confirm('Есть несохранённые изменения. Выбрать другую платёжную систему?')) return;
        setSelected(name);
        setDraft(providers.find((item) => item.provider === name).settings);
        setSaveStatus('idle');
        setError('');
    }

    async function performAction(kind, form) {
        if (!provider || action || kind === 'save' && !dirty || kind === 'activate' && dirty) return;
        form ||= document.getElementById('payments-form');
        const deletingSecret = kind === 'delete-secret';
        setAction(kind);
        setError('');
        if (kind === 'save') setSaveStatus('saving');
        try {
            const result = await readPayments(await apiRequest(`/api/site/payments/${encodeURIComponent(provider.provider)}${kind === 'save' ? '' : deletingSecret ? '/secret-key' : '/activation'}`, {
                method: deletingSecret ? 'DELETE' : 'PATCH',
                ...(deletingSecret ? {} : {
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(kind === 'save' ? { settings: draft } : { isActive: kind === 'activate' }),
                }),
            }), form);
            setProviders(result);
            if (kind === 'save' || !dirty) setDraft(result.find((item) => item.provider === selected).settings);
            else if (deletingSecret) setDraft(({ secretKey, ...settings }) => settings);
            if (deletingSecret) setSaveStatus('idle');
        } catch (saveError) {
            setError('Не удалось изменить платёжные настройки. Проверьте поля и повторите попытку.');
            if (kind === 'save') setSaveStatus('error');
            if (kind === 'save') throw saveError;
        } finally { setAction(null); }
    }

    async function saveAll(event) {
        event.preventDefault();
        const form = event.currentTarget;
        if (action || saveStatus === 'saving') return;
        setSaveStatus('saving');
        try {
            if (dirty) await performAction('save', form);
            await notifications.save(form);
            setSaveStatus('success');
        } catch { setSaveStatus('error'); }
    }

    return <SiteSettingsLayout
        section="payments" title="Платежи" status={status} errorMessage={error}
        isDirty={dirty || notifications.dirty} saveStatus={saveStatus} onSave={() => document.getElementById('payments-form')?.requestSubmit()}
        formId="payments-form"
    >
        <AdminPanel as="form" id="payments-form" onSubmit={saveAll} onInput={() => { if (saveStatus !== 'saving') { setSaveStatus('idle'); setError(''); } }} className={styles.panel}>
            <p className={styles.status} role="status">{active ? `Активная система: ${active.name}` : 'Нет активной платёжной системы.'}</p>
            <label className={`${compactStyles.field} ${compactStyles.compact} ${styles.selector}`}>
                <span>Платёжная система</span>
                <select value={selected} disabled={Boolean(action) || saveStatus === 'saving'} onChange={(event) => selectProvider(event.target.value)}>
                    {providers.map((item) => <option value={item.provider} key={item.provider}>{item.name}</option>)}
                </select>
            </label>
            {provider && <>
                <div>
                    <h2>Подключение Prodamus</h2>
                    <ol>
                        <li>Укажите URL вашей платёжной страницы и секретный ключ из настроек Prodamus, сохраните настройки и активируйте подключение.</li>
                        <li>В кабинете Prodamus в поле «URL адреса для уведомлений» укажите адрес ниже. Собственный sys для подключения не требуется.</li>
                        <li>Рекомендуем сделать телефон и email обязательными на стороне Prodamus. Покупатель вводит их на платёжной странице.</li>
                    </ol>
                    <label className={compactStyles.field}><span>URL webhook</span><input readOnly value={webhookUrl} onFocus={(event) => event.target.select()} /></label>
                    <p>Тестовый режим создаёт отдельные тестовые заказы. Для проверки используйте тестовые карты Prodamus и отдельную демо-форму; не включайте деморежим в кабинете боевой формы.</p>
                </div>
                <PaymentIntegrationEditor provider={provider} settings={draft} validateRequired={dirty} disabled={Boolean(action) || saveStatus === 'saving'} onChange={(settings) => { setDraft(settings); setSaveStatus('idle'); setError(''); }} onDeleteSecretKey={() => performAction('delete-secret')} />
                <div className={styles.actions}>
                    {provider.isActive
                        ? <Button disabled={Boolean(action) || saveStatus === 'saving'} onClick={() => performAction('deactivate')}>{action === 'deactivate' ? 'Отключение…' : 'Отключить'}</Button>
                        : <Button disabled={dirty || Boolean(action) || saveStatus === 'saving'} onClick={() => performAction('activate')}>{action === 'activate' ? 'Активация…' : 'Активировать'}</Button>}
                </div>
                {dirty && <p className={styles.hint}>Сохраните настройки перед активацией.</p>}
            </>}
            {error && <p className={styles.error} role="alert">{error}</p>}
            <OrderNotificationSettings state={notifications} disabled={saveStatus === 'saving'} />
        </AdminPanel>
    </SiteSettingsLayout>;
}
