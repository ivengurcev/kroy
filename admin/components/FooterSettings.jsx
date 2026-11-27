import { Input, Select, Textarea } from '../ui/NativeControls.jsx';
import ListField from '../editor/ListField.jsx';
import { availableFooterPages, FOOTER_DOCUMENTS } from '../../shared/footerSettings.mjs';
import styles from './FooterSettings.module.css';
import compactStyles from '../ui/CompactForm.module.css';

function pageSelect(pages, label, name, id, onSelect, required = false) {
    return <label className={`${styles.formField} ${compactStyles.field} ${compactStyles.long}`}>
        <span>{label}</span>
        <Select name={name} value={id ?? ''} required={required} onChange={(event) => onSelect(event.target.value || null)}>
            <option value="">{required ? 'Выберите страницу' : 'Не выбрана'}</option>
            {id && !pages.some((page) => page.id === id) && <option value={id} disabled>Недоступная страница — выберите другую</option>}
            {pages.map((page) => <option key={page.id} value={page.id}>{page.title} — {page.path}</option>)}
        </Select>
    </label>;
}

export function PageNavigationField({ pages, value, onChange }) {
    const eligible = availableFooterPages(pages);
    return <ListField label="Навигация" itemLabel="Страница" value={value ?? []}
        createItem={() => ({ pageId: null })}
        itemSummary={({ pageId }) => eligible.find(({ id }) => id === pageId)?.title ?? 'Недоступная страница'}
        onChange={onChange}
        renderItem={(item, index, change) => pageSelect(eligible, 'Страница', 'pageId', item.pageId, (pageId) => change({ pageId }), true)} />;
}

export default function FooterSettings({ value, onChange, pages }) {
    const eligible = availableFooterPages(pages);
    const settings = value ?? {};
    const documents = settings.documents ?? {};
    const legal = settings.legal ?? {};
    const update = (name, next) => onChange({ ...settings, [name]: next });
    const pageName = (id) => eligible.find((page) => page.id === id)?.title ?? 'Недоступная страница';
    function textField(label, name, text, maxLength, onUpdate) {
        return <label className={`${styles.formField} ${compactStyles.field} ${compactStyles.long}`}>
            <span>{label}</span>
            <Input name={name} value={text ?? ''} maxLength={maxLength} onChange={(event) => onUpdate(event.target.value)} />
        </label>;
    }

    return <div className={styles.contactPanel}>
        <div className={styles.formGrid}>
            <label className={`${styles.formField} ${compactStyles.field} ${compactStyles.long}`}>
                <span>Краткое описание сайта</span>
                <Textarea rows={3} maxLength={1000} value={settings.description ?? ''} onChange={(event) => update('description', event.target.value)} />
            </label>
        </div>
        <PageNavigationField pages={pages} value={settings.navigation} onChange={(navigation) => update('navigation', navigation)} />
        <h2>Правовые документы</h2>
        <div className={styles.formGrid}>
            {Object.entries(FOOTER_DOCUMENTS).map(([name, label]) => <div key={name}>
                {pageSelect(eligible, label, `documents.${name}`, documents[name], (pageId) => update('documents', { ...documents, [name]: pageId }))}
            </div>)}
        </div>
        <ListField label="Другие документы" itemLabel="Документ" value={documents.additional ?? []}
            createItem={() => ({ pageId: null })} itemSummary={(item) => item.pageId ? pageName(item.pageId) : item.label || 'Документ'}
            onChange={(items) => update('documents', { ...documents, additional: items.map((item) => typeof item.url === 'string'
                ? { label: item.label, url: item.url } : { pageId: item.pageId }) })}
            renderItem={(item, index, change) => <>
                <label className={styles.formField}>Тип ссылки
                    <Select value={typeof item.url === 'string' ? 'external' : 'page'} onChange={(event) => change(event.target.value === 'external'
                        ? { pageId: undefined, label: '', url: '' } : { pageId: null, label: undefined, url: undefined })}>
                        <option value="page">Страница сайта</option>
                        <option value="external">Внешний документ</option>
                    </Select>
                </label>
                {typeof item.url === 'string' ? <>
                    <label className={styles.formField}>Название<Input name="label" required maxLength={200} value={item.label ?? ''} onChange={(event) => change({ label: event.target.value })} /></label>
                    <label className={styles.formField}>Ссылка<Input name="url" type="url" required pattern="https?://.+" maxLength={2000} value={item.url} onChange={(event) => change({ url: event.target.value })} /></label>
                </> : pageSelect(eligible, 'Страница', 'pageId', item.pageId, (pageId) => change({ pageId }), true)}
            </>} />
        <h2>Реквизиты</h2>
        <div className={styles.formGrid}>
            {textField('Юридическое наименование', 'legal.name', legal.name, 500, (name) => update('legal', { ...legal, name }))}
            {textField('ИНН', 'legal.inn', legal.inn, 12, (inn) => update('legal', { ...legal, inn }))}
            {textField('ОГРН/ОГРНИП', 'legal.registrationNumber', legal.registrationNumber, 15, (registrationNumber) => update('legal', { ...legal, registrationNumber }))}
        </div>
        <p>Телефон, email, адрес и социальные сети берутся из раздела <a href="/admin/contacts">«Контакты»</a>.</p>
    </div>;
}
