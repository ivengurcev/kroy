import compactStyles from '../ui/CompactForm.module.css';
import styles from './PaymentIntegrationEditor.module.css';
import Button from '../ui/Button.jsx';

export default function PaymentIntegrationEditor({ provider, settings, disabled, onChange, onDeleteSecretKey }) {
    return <div className={styles.fields}>
        {Object.entries(provider.fields).map(([name, field]) => <div key={name}>
            <label className={`${compactStyles.field} ${compactStyles.compact}`}>
                <span>{field.label}</span>
                <input
                    type={field.type}
                    {...(field.type === 'checkbox' ? { checked: settings[name] === true } : { value: settings[name] ?? '' })}
                    placeholder={field.configured ? 'Ключ сохранён; оставьте поле пустым, чтобы не менять' : field.placeholder}
                    autoComplete={field.type === 'password' ? 'new-password' : undefined}
                    required={field.required}
                    disabled={disabled}
                    onChange={(event) => onChange({ ...settings, [name]: field.type === 'checkbox' ? event.target.checked : event.target.value })}
                />
            </label>
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
