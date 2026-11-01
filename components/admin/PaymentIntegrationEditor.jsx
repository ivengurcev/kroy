import compactStyles from '../ui/CompactForm.module.css';
import styles from './PaymentIntegrationEditor.module.css';

export default function PaymentIntegrationEditor({ provider, settings, disabled, onChange }) {
    return <div className={styles.fields}>
        {Object.entries(provider.fields).map(([name, field]) => <label className={`${compactStyles.field} ${compactStyles.compact}`} key={name}>
            <span>{field.label}</span>
            <input
                type={field.type}
                value={settings[name] ?? ''}
                placeholder={field.configured ? 'Ключ сохранён; оставьте поле пустым, чтобы не менять' : field.placeholder}
                autoComplete={field.type === 'password' ? 'new-password' : undefined}
                required={field.required}
                disabled={disabled}
                onChange={(event) => onChange({ ...settings, [name]: event.target.value })}
            />
        </label>)}
        <p className={styles.currency}>Валюта: {provider.currency}</p>
    </div>;
}
