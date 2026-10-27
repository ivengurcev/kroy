import Button from '../ui/Button.jsx';
import Icon from '../ui/Icon.jsx';
import {
    buildSocialLink,
    SOCIAL_TYPES,
    socialLabel,
    socialType,
} from '../../socialLinks.mjs';
import styles from './SocialLinksEditor.module.css';

function emptyItem() {
    return { type: 'telegram', value: '', name: socialLabel('telegram'), link: '' };
}

export default function SocialLinksEditor({ value, onChange }) {
    const items = Array.isArray(value) ? value : [];

    function update(index, changes) {
        onChange(items.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item));
    }

    function changeType(index, type) {
        update(index, {
            type,
            value: '',
            name: type === 'other' ? '' : socialLabel(type),
            link: '',
        });
    }

    function changeValue(index, valueToStore) {
        const type = socialType(items[index]);
        update(index, {
            value: valueToStore,
            link: buildSocialLink(type, valueToStore),
        });
    }

    function remove(index) {
        onChange(items.filter((_, itemIndex) => itemIndex !== index));
    }

    function move(index, direction) {
        const target = index + direction;
        if (target < 0 || target >= items.length) return;
        const next = [...items];
        [next[index], next[target]] = [next[target], next[index]];
        onChange(next);
    }

    return (
        <fieldset className={styles.editor}>
            <legend>Социальные сети</legend>
            <div className={styles.items}>
                {items.map((item, index) => {
                    const type = socialType(item);
                    const previewLink = buildSocialLink(type, item.value || item.link);
                    const isNickname = !['max', 'other'].includes(type);

                    return (
                        <div className={styles.item} key={`${type}-${index}`}>
                            <div className={styles.itemHeader}>
                                <strong>{item.name || socialLabel(type)}</strong>
                                <div className={styles.actions}>
                                    <Button variant="compact" title="Переместить выше" aria-label="Переместить выше" disabled={index === 0} onClick={() => move(index, -1)}><Icon name="up" /></Button>
                                    <Button variant="compact" title="Переместить ниже" aria-label="Переместить ниже" disabled={index === items.length - 1} onClick={() => move(index, 1)}><Icon name="down" /></Button>
                                    <Button variant="compact" title="Удалить ссылку" aria-label="Удалить ссылку" onClick={() => remove(index)}><Icon name="delete" /></Button>
                                </div>
                            </div>
                            <label className={styles.field}>
                                <span>Тип</span>
                                <select value={type} onChange={(event) => changeType(index, event.target.value)}>
                                    {SOCIAL_TYPES.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
                                </select>
                            </label>
                            {isNickname && <label className={styles.field}>
                                <span>Никнейм</span>
                                <input value={item.value ?? ''} placeholder="@username или полная ссылка" onChange={(event) => changeValue(index, event.target.value)} />
                            </label>}
                            {type === 'max' && <label className={styles.field}>
                                <span>Ссылка из приложения</span>
                                <input type="url" value={item.value ?? ''} placeholder="https://max.ru/..." onChange={(event) => changeValue(index, event.target.value)} />
                            </label>}
                            {type === 'other' && <>
                                <label className={styles.field}>
                                    <span>Название</span>
                                    <input value={item.name ?? ''} onChange={(event) => update(index, { name: event.target.value })} />
                                </label>
                                <label className={styles.field}>
                                    <span>Ссылка (HTTPS)</span>
                                    <input type="url" value={item.value ?? item.link ?? ''} placeholder="https://example.com" onChange={(event) => changeValue(index, event.target.value)} />
                                </label>
                            </>}
                            {previewLink && <a className={styles.preview} href={previewLink} target="_blank" rel="noopener noreferrer">{previewLink}</a>}
                            {item.value && !previewLink && <p className={styles.error} role="alert">Введите корректную HTTPS-ссылку или никнейм.</p>}
                        </div>
                    );
                })}
            </div>
            <Button className={styles.add} onClick={() => onChange([...items, emptyItem()])}><Icon name="add" /> Добавить ссылку</Button>
        </fieldset>
    );
}
