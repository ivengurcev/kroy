import { Input, Select, Textarea } from '../ui/NativeControls.jsx';
import ListField from '../editor/ListField.jsx';
import { availableFooterPages, legacyFooterDocuments, omitLegacyFooterDocument } from '../../shared/footerSettings.mjs';
import { useEffect, useState } from 'react';
import Button from '../ui/Button.jsx';
import Icon from '../ui/Icon.jsx';
import Tree, { TreeEmpty, TreeGroup, TreeItem } from '../ui/Tree.jsx';
import LegalDocumentDialog from './LegalDocumentDialog.jsx';
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

function LegalDocuments({ pages, documents, onChange, actions }) {
    const [dialog, setDialog] = useState(null);
    const refresh = actions.refresh;
    useEffect(() => {
        refresh();
        window.addEventListener('focus', refresh);
        return () => window.removeEventListener('focus', refresh);
    }, [refresh]);
    const automatic = pages.filter(({ isLegalDocument }) => isLegalDocument);
    const legacy = legacyFooterDocuments(documents).filter(({ pageId }) => !automatic.some(({ id }) => id === pageId));

    return <>
        <TreeGroup label="Правовые документы">
            <div><Button variant="compact" onClick={() => setDialog({})}><Icon name="add" /> Добавить документ</Button></div>
            {automatic.length ? <Tree>{automatic.map((page) => <TreeItem key={page.id} icon="document"
                label={<span className={styles.documentLink}>{page.title}<small>{page.path}</small></span>} title={`${page.title} — ${page.path}`}
                actions={<Button variant="listIcon" title="Редактировать документ" aria-label={`Редактировать «${page.title}»`}
                    onClick={() => setDialog(page)}><Icon name="edit" size={16} /></Button>} />)}</Tree>
                : <TreeEmpty>Правовых документов пока нет.</TreeEmpty>}
        </TreeGroup>
        {legacy.length > 0 && <TreeGroup label="Прежние ссылки на страницы">
            <Tree>{legacy.map(({ key, label, pageId }) => {
                const page = pages.find(({ id }) => id === pageId);
                return <TreeItem key={key} muted={!page}
                    label={page ? `${label ?? page.title} — ${page.path}` : label ?? 'Недоступная страница'}
                    href={page && (page.path === '/' ? '/admin' : `/admin/pages/${page.id}`)}
                    actions={<>
                        {page?.type === 'standard' && <a href={page.path === '/' ? '/admin' : `/admin/pages/${page.id}`}
                            title="Отметить как правовой документ в редакторе страницы"
                            aria-label={`Настроить признак «Правовой документ» страницы «${page.title}»`}><Icon name="edit" size={16} /></a>}
                        <Button variant="listIcon" title="Убрать прежнюю ссылку" aria-label={`Убрать прежнюю ссылку «${label ?? page?.title ?? 'Недоступная страница'}»`}
                            onClick={() => onChange(omitLegacyFooterDocument(documents, key))}><Icon name="delete" size={16} /></Button>
                    </>} />;
            })}</Tree>
        </TreeGroup>}
        {dialog && <LegalDocumentDialog id={dialog.id} onCancel={() => setDialog(null)}
            onDirtyChange={actions.setDirty} onUnavailable={actions.refresh}
            onSaved={(page) => { actions.onSaved(page); setDialog(null); }} />}
    </>;
}

export default function FooterSettings({ value, onChange, pages, legalDocumentActions }) {
    const eligible = availableFooterPages(pages);
    const settings = value ?? {};
    const documents = settings.documents ?? {};
    const legal = settings.legal ?? {};
    const update = (name, next) => onChange({ ...settings, [name]: next });
    function updateExternalDocuments(items) {
        const external = items.map(({ label, url }) => ({ label, url }));
        const additional = (documents.additional ?? []).flatMap((item) =>
            item.pageId ? [item] : external.length ? [external.shift()] : []);
        update('documents', { ...documents, additional: [...additional, ...external] });
    }
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
        <LegalDocuments pages={eligible} documents={documents} actions={legalDocumentActions}
            onChange={(next) => update('documents', next)} />
        <ListField label="Внешние документы" itemLabel="Документ" value={(documents.additional ?? []).filter(({ url }) => url)}
            createItem={() => ({ label: '', url: '' })} itemSummary={(item) => item.label || 'Документ'}
            onChange={updateExternalDocuments}
            renderItem={(item, index, change) => <>
                <label className={styles.formField}>Название<Input name="label" required maxLength={200} value={item.label ?? ''} onChange={(event) => change({ label: event.target.value })} /></label>
                <label className={styles.formField}>Ссылка<Input name="url" type="url" required pattern="https?://.+" maxLength={2000} value={item.url} onChange={(event) => change({ url: event.target.value })} /></label>
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
