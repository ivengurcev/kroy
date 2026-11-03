import { useEffect, useState } from 'react';
import SiteSettingsLayout from '../components/SiteSettingsLayout.jsx';
import PaymentIntegrationEditor from '../components/PaymentIntegrationEditor.jsx';
import AdminPanel from '../ui/AdminPanel.jsx';
import Button from '../ui/Button.jsx';
import compactStyles from '../ui/CompactForm.module.css';
import styles from './SitePaymentsPage.module.css';

async function readPayments(response) {
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Не удалось загрузить платёжные настройки.');
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
    const provider = providers.find((item) => item.provider === selected);
    const active = providers.find((item) => item.isActive);
    const dirty = Boolean(provider && JSON.stringify(draft) !== JSON.stringify(provider.settings));

    useEffect(() => {
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

    async function performAction(kind) {
        if (!provider || action || kind === 'save' && !dirty || kind === 'activate' && dirty) return;
        const deletingSecret = kind === 'delete-secret';
        setAction(kind);
        setError('');
        if (kind === 'save') setSaveStatus('saving');
        try {
            const result = await readPayments(await fetch(`/api/site/payments/${encodeURIComponent(provider.provider)}${kind === 'save' ? '' : deletingSecret ? '/secret-key' : '/activation'}`, {
                method: deletingSecret ? 'DELETE' : 'PATCH',
                ...(deletingSecret ? {} : {
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(kind === 'save' ? { settings: draft } : { isActive: kind === 'activate' }),
                }),
            }));
            setProviders(result);
            if (kind === 'save' || !dirty) setDraft(result.find((item) => item.provider === selected).settings);
            else if (deletingSecret) setDraft(({ secretKey, ...settings }) => settings);
            if (kind === 'save') setSaveStatus('success');
            if (deletingSecret) setSaveStatus('idle');
        } catch (saveError) {
            setError(saveError.message);
            if (kind === 'save') setSaveStatus('error');
        } finally { setAction(null); }
    }

    return <SiteSettingsLayout
        section="payments" title="Платежи" status={status} errorMessage={error}
        isDirty={dirty} saveStatus={saveStatus} onSave={() => performAction('save')}
    >
        <AdminPanel className={styles.panel}>
            <p className={styles.status} role="status">{active ? `Активная система: ${active.name}` : 'Нет активной платёжной системы.'}</p>
            <label className={`${compactStyles.field} ${compactStyles.compact} ${styles.selector}`}>
                <span>Платёжная система</span>
                <select value={selected} disabled={Boolean(action)} onChange={(event) => selectProvider(event.target.value)}>
                    {providers.map((item) => <option value={item.provider} key={item.provider}>{item.name}</option>)}
                </select>
            </label>
            {provider && <>
                <PaymentIntegrationEditor provider={provider} settings={draft} disabled={Boolean(action)} onChange={(settings) => { setDraft(settings); setSaveStatus('idle'); }} onDeleteSecretKey={() => performAction('delete-secret')} />
                <div className={styles.actions}>
                    <Button variant="primary" disabled={!dirty || Boolean(action)} onClick={() => performAction('save')}>
                        {action === 'save' ? 'Сохранение…' : 'Сохранить настройки'}
                    </Button>
                    {provider.isActive
                        ? <Button disabled={Boolean(action)} onClick={() => performAction('deactivate')}>{action === 'deactivate' ? 'Отключение…' : 'Отключить'}</Button>
                        : <Button disabled={dirty || Boolean(action)} onClick={() => performAction('activate')}>{action === 'activate' ? 'Активация…' : 'Активировать'}</Button>}
                </div>
                {dirty && <p className={styles.hint}>Сохраните настройки перед активацией.</p>}
            </>}
            {error && <p className={styles.error} role="alert">{error}</p>}
        </AdminPanel>
    </SiteSettingsLayout>;
}
