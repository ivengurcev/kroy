import ListField from '../editor/ListField.jsx';
import { buildSocialLink, SOCIAL_TYPES, socialLabel, socialType } from '../../shared/socialLinks.mjs';
import styles from './SocialLinksEditor.module.css';
import compactStyles from '../ui/CompactForm.module.css';

function emptyItem() {
    return { type: 'telegram', value: '', name: socialLabel('telegram'), link: '' };
}

export default function SocialLinksEditor({ value, onChange }) {
    return <ListField label="Социальные сети" itemLabel="Соцсеть" value={value} onChange={onChange}
        createItem={emptyItem} itemSummary={(item) => socialLabel(socialType(item))}
        renderItem={(item, index, update) => {
            const type = socialType(item);
            const previewLink = buildSocialLink(type, item.value || item.link);
            const isNickname = !['max', 'other'].includes(type);
            const changeValue = (nextValue) => update({ value: nextValue, link: buildSocialLink(type, nextValue) });
            const validationMessage = item.value && !previewLink ? 'Введите корректную HTTPS-ссылку или никнейм' : '';
            return <div className={styles.fields} data-validation-group>
                <label className={`${styles.formField} ${compactStyles.field} ${compactStyles.compact}`}>
                    <span>Тип</span>
                    <select value={type} onChange={(event) => {
                        const nextType = event.target.value;
                        update({ type: nextType, value: '', name: nextType === 'other' ? '' : socialLabel(nextType), link: '' });
                    }}>
                        {SOCIAL_TYPES.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
                    </select>
                </label>
                {isNickname && <label className={`${styles.formField} ${compactStyles.field} ${compactStyles.compact}`}>
                    <span>Никнейм</span>
                    <input name={`socials.${index}`} data-validation-message={validationMessage} value={item.value ?? ''} placeholder="@username или полная ссылка" onChange={(event) => changeValue(event.target.value)} />
                </label>}
                {type === 'max' && <label className={`${styles.formField} ${compactStyles.field} ${compactStyles.compact}`}>
                    <span>Ссылка из приложения</span>
                    <input name={`socials.${index}`} data-validation-message={validationMessage} type="url" value={item.value ?? ''} placeholder="https://max.ru/..." onChange={(event) => changeValue(event.target.value)} />
                </label>}
                {type === 'other' && <>
                    <label className={`${styles.formField} ${compactStyles.field} ${compactStyles.compact}`}>
                        <span>Название</span>
                        <input value={item.name ?? ''} onChange={(event) => update({ name: event.target.value })} />
                    </label>
                    <label className={`${styles.formField} ${compactStyles.field} ${compactStyles.compact}`}>
                        <span>Ссылка (HTTPS)</span>
                        <input name={`socials.${index}`} data-validation-message={validationMessage} type="url" value={item.value ?? item.link ?? ''} placeholder="https://example.com" onChange={(event) => changeValue(event.target.value)} />
                    </label>
                </>}
                {previewLink && <a className={styles.preview} href={previewLink} target="_blank" rel="noopener noreferrer">{previewLink}</a>}
                {validationMessage && <p className={styles.error} role="alert">{validationMessage}.</p>}
            </div>;
        }} />;
}
