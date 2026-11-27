import { Input } from '../ui/NativeControls.jsx';
import compactStyles from '../ui/CompactForm.module.css';
import styles from './PaymentIntegrationEditor.module.css';
import Button from '../ui/Button.jsx';
import Switch from '../ui/Switch.jsx';

export default function PaymentIntegrationEditor({ provider, settings, disabled, onChange, onDeleteSecretKey, validateRequired = true }) {
    return <div className={styles.fields}>
        {Object.entries(provider.fields).map(([name, field]) => <div key={name}>
            {field.type === 'checkbox' ? <Switch name={name} label={field.label} checked={settings[name] === true} disabled={disabled}
                onChange={(event) => onChange({ ...settings, [name]: event.target.checked })} /> : <label className={`${compactStyles.field} ${compactStyles.compact}`}>
                <span>{field.label}</span>
                <Input
                    name={name}
                    type={field.type}
                    value={settings[name] ?? ''}
                    placeholder={field.configured ? 'Ключ сохранён; оставьте поле пустым, чтобы не менять' : field.placeholder}
                    autoComplete={field.type === 'password' ? 'new-password' : undefined}
                    required={validateRequired && field.required}
                    disabled={disabled}
                    onChange={(event) => onChange({ ...settings, [name]: event.target.value })}
                />
            </label>}
            {name === 'secretKey' && field.configured && <div className={styles.secretActions}>
                <span>Ключ сохранён</span>
                <Button variant="danger" disabled={disabled} onClick={() => {
                    if (window.confirm('Удалить секретный ключ? Платёжная интеграция будет отключена.')) onDeleteSecretKey();
                }}>Удалить секретный ключ</Button>
            </div>}
        </div>)}
        <p className={styles.currency}>Валюта: {provider.currency}</p>
    </div>;
}
