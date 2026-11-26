import { useEffect, useState } from 'react';
import AdminPanel from '../ui/AdminPanel.jsx';
import ListField from '../editor/ListField.jsx';
import { availableFooterPages, FOOTER_DOCUMENTS } from '../../shared/footerSettings.mjs';
import styles from './FooterSettings.module.css';
import compactStyles from '../ui/CompactForm.module.css';

export default function FooterSettings({ value, onChange, onSave }) {
    const [pages, setPages] = useState([]);
    const [status, setStatus] = useState('loading');
    useEffect(() => {
        const controller = new AbortController();
        fetch('/api/pages', { signal: controller.signal })
            .then(async (response) => {
                if (!response.ok) throw new Error();
                const result = await response.json();
                if (!Array.isArray(result)) throw new Error();
                setPages(availableFooterPages(result));
                setStatus('success');
            })
            .catch((error) => { if (error.name !== 'AbortError') setStatus('error'); });
        return () => controller.abort();
    }, []);
    const settings = value ?? {};
    const documents = settings.documents ?? {};
    const legal = settings.legal ?? {};
    const update = (name, next) => onChange({ ...settings, [name]: next });
    const pageName = (id) => pages.find((page) => page.id === id)?.title ?? 'Недоступная страница';
    function pageSelect(label, name, id, onSelect, required = false) {
        return <label className={`${styles.formField} ${compactStyles.field} ${compactStyles.long}`}>
            <span>{label}</span>
            <select name={name} value={id ?? ''} required={required} disabled={status !== 'success'} onChange={(event) => onSelect(event.target.value || null)}>
                <option value="">{required ? 'Выберите страницу' : 'Не выбрана'}</option>
                {id && !pages.some((page) => page.id === id) && <option value={id} disabled>Недоступная страница — выберите другую</option>}
                {pages.map((page) => <option key={page.id} value={page.id}>{page.title} — {page.path}</option>)}
            </select>
        </label>;
    }
    function textField(label, name, text, maxLength, onUpdate) {
        return <label className={`${styles.formField} ${compactStyles.field} ${compactStyles.long}`}>
            <span>{label}</span>
            <input name={name} value={text ?? ''} maxLength={maxLength} onChange={(event) => onUpdate(event.target.value)} />
        </label>;
    }

    return <AdminPanel as="form" id="footer-form" className={styles.contactPanel} onSubmit={(event) => { event.preventDefault(); onSave(); }}>
        <p>Футер отображается на всех страницах. Ссылка «Создано на Oysite» обязательна.</p>
        <div className={styles.formGrid}>
            <label className={`${styles.formField} ${compactStyles.field} ${compactStyles.long}`}>
                <span>Краткое описание сайта</span>
                <textarea rows={3} maxLength={1000} value={settings.description ?? ''} onChange={(event) => update('description', event.target.value)} />
            </label>
        </div>
        {status === 'loading' && <p role="status">Загрузка страниц…</p>}
        {status === 'error' && <p role="alert">Не удалось загрузить страницы. Обновите раздел перед изменением ссылок.</p>}
        <ListField label="Навигация" itemLabel="Страница" value={settings.navigation ?? []}
            createItem={() => ({ pageId: null })} itemSummary={(item) => pageName(item.pageId)}
            onChange={(navigation) => update('navigation', navigation)}
            renderItem={(item, index, change) => pageSelect('Страница', 'pageId', item.pageId, (pageId) => change({ pageId }), true)} />
        <h2>Правовые документы</h2>
        <div className={styles.formGrid}>
            {Object.entries(FOOTER_DOCUMENTS).map(([name, label]) => <div key={name}>
                {pageSelect(label, `documents.${name}`, documents[name], (pageId) => update('documents', { ...documents, [name]: pageId }))}
            </div>)}
        </div>
        <ListField label="Другие документы" itemLabel="Документ" value={documents.additional ?? []}
            createItem={() => ({ pageId: null })} itemSummary={(item) => item.pageId ? pageName(item.pageId) : item.label || 'Документ'}
            onChange={(items) => update('documents', { ...documents, additional: items.map((item) => typeof item.url === 'string'
                ? { label: item.label, url: item.url } : { pageId: item.pageId }) })}
            renderItem={(item, index, change) => <>
                <label className={styles.formField}>Тип ссылки
                    <select value={typeof item.url === 'string' ? 'external' : 'page'} onChange={(event) => change(event.target.value === 'external'
                        ? { pageId: undefined, label: '', url: '' } : { pageId: null, label: undefined, url: undefined })}>
                        <option value="page">Страница сайта</option>
                        <option value="external">Внешний документ</option>
                    </select>
                </label>
                {typeof item.url === 'string' ? <>
                    <label className={styles.formField}>Название<input name="label" required maxLength={200} value={item.label ?? ''} onChange={(event) => change({ label: event.target.value })} /></label>
                    <label className={styles.formField}>Ссылка<input name="url" type="url" required pattern="https?://.+" maxLength={2000} value={item.url} onChange={(event) => change({ url: event.target.value })} /></label>
                </> : pageSelect('Страница', 'pageId', item.pageId, (pageId) => change({ pageId }), true)}
            </>} />
        <h2>Реквизиты</h2>
        <div className={styles.formGrid}>
            {textField('Юридическое наименование', 'legal.name', legal.name, 500, (name) => update('legal', { ...legal, name }))}
            {textField('ИНН', 'legal.inn', legal.inn, 12, (inn) => update('legal', { ...legal, inn }))}
            {textField('ОГРН/ОГРНИП', 'legal.registrationNumber', legal.registrationNumber, 15, (registrationNumber) => update('legal', { ...legal, registrationNumber }))}
        </div>
        <p>Телефон, email, адрес и социальные сети берутся из раздела <a href="/admin/contacts">«Контакты»</a>.</p>
    </AdminPanel>;
}
