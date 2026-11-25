import { useContext, useEffect, useMemo, useState } from 'react';
import ApplicationContext from '@vyaz/core/Context.js';
import Button from '../ui/Button.jsx';
import AdminPanel from '../ui/AdminPanel.jsx';
import Icon from '../ui/Icon.jsx';
import { ThemeModeControl, ThemePicker, TokenTable } from '../components/AppearanceControls.jsx';
import ImageField from '../editor/ImageField.jsx';
import SocialLinksEditor from '../components/SocialLinksEditor.jsx';
import CatalogEditor from '../components/CatalogEditor.jsx';
import SiteSettingsLayout, { SITE_SETTINGS_SECTIONS } from '../components/SiteSettingsLayout.jsx';
import styles from './SitePage.module.css';
import compactStyles from '../ui/CompactForm.module.css';
import { apiRequest } from '../editor/apiRequest.mjs';
import { formResponseError } from '../ui/formValidation.mjs';
import ValidatedForm from '../ui/ValidatedForm.jsx';
import SeoFields from '../components/SeoFields.jsx';
import { siteSettingsDirty } from './siteSettingsState.mjs';

function cloneSettings(settings) {
    return { themeId: settings.themeId, themeMode: settings.themeMode, separatorMediaId: settings.separatorMediaId ?? null, overrides: { light: { ...(settings.overrides?.light ?? {}) }, dark: { ...(settings.overrides?.dark ?? {}) }, shared: { ...(settings.overrides?.shared ?? {}) } } };
}

function ContactSettings({ value, onChange, onSave }) {
    const contacts = value ?? {};
    const update = (name, nextValue) => onChange({ ...contacts, [name]: nextValue });

    return (
        <AdminPanel as="form" id="contact-form" onSubmit={(event) => { event.preventDefault(); onSave(); }} className={styles.contactPanel}>
            <div className={styles.formGrid}>
                <label className={`${styles.formField} ${compactStyles.field} ${compactStyles.long}`}>
                    <span>Адрес</span>
                    <textarea rows="3" value={contacts.address ?? ''} onChange={(event) => update('address', event.target.value)} />
                </label>
                <label className={`${styles.formField} ${compactStyles.field} ${compactStyles.long}`}>
                    <span>Режим работы</span>
                    <textarea rows="3" value={contacts.hours ?? ''} onChange={(event) => update('hours', event.target.value)} />
                </label>
                <label className={`${styles.formField} ${compactStyles.field} ${compactStyles.compact}`}>
                    <span>Телефон</span>
                    <input type="tel" value={contacts.phone ?? ''} onChange={(event) => update('phone', event.target.value)} />
                </label>
                <div className={styles.coordinateGrid}>
                    <label className={`${styles.formField} ${compactStyles.field} ${compactStyles.compact}`}>
                        <span>Широта</span>
                        <input name="latitude" type="number" min="-90" max="90" step="any" value={contacts.latitude ?? ''} onChange={(event) => update('latitude', event.target.value === '' ? null : Number(event.target.value))} />
                    </label>
                    <label className={`${styles.formField} ${compactStyles.field} ${compactStyles.compact}`}>
                        <span>Долгота</span>
                        <input name="longitude" type="number" min="-180" max="180" step="any" value={contacts.longitude ?? ''} onChange={(event) => update('longitude', event.target.value === '' ? null : Number(event.target.value))} />
                    </label>
                </div>
            </div>
            <SocialLinksEditor value={contacts.socials ?? []} onChange={(socials) => update('socials', socials)} />
        </AdminPanel>
    );
}

function Overview({ siteData }) {
    return <AdminPanel className={styles.overviewPanel}>
        <dl className={styles.overviewList}>
            <div><dt>Название сайта</dt><dd>{siteData?.site?.name || '—'}</dd></div>
            <div><dt>Идентификатор</dt><dd>{siteData?.site?.slug || '—'}</dd></div>
            <div><dt>Домены</dt><dd>{siteData?.domains?.length ? siteData.domains.join(', ') : 'Домены не добавлены'}</dd></div>
        </dl>
    </AdminPanel>;
}

export default function SitePage() {
    const { pathname } = useContext(ApplicationContext) || {};
    const [section, setSection] = useState('appearance');
    const [seo, setSeo] = useState(null);
    const [savedSeo, setSavedSeo] = useState(null);
    const [themes, setThemes] = useState([]); const [metadata, setMetadata] = useState({}); const [saved, setSaved] = useState(null); const [draft, setDraft] = useState(null); const [siteData, setSiteData] = useState(null); const [savedContacts, setSavedContacts] = useState(null); const [contacts, setContacts] = useState(null); const [status, setStatus] = useState('loading'); const [saveStatus, setSaveStatus] = useState('idle'); const [error, setError] = useState('');
    useEffect(() => {
        const controller = new AbortController();
        Promise.all([
            fetch('/api/site/theme', { signal: controller.signal }),
            fetch('/api/site/settings', { signal: controller.signal }),
        ]).then(async ([themeResponse, siteResponse]) => {
            if (!themeResponse.ok || !siteResponse.ok) throw new Error('Не удалось загрузить настройки сайта.');
            return Promise.all([themeResponse.json(), siteResponse.json()]);
        }).then(([themeResult, siteResult]) => {
            setSeo(siteResult.seo ?? {}); setSavedSeo(siteResult.seo ?? {});
            const next = cloneSettings(themeResult.settings); const nextContacts = siteResult.contacts;
            setThemes(themeResult.themes); setMetadata(themeResult.metadata || {}); setSaved(next); setDraft(next); setSiteData(siteResult); setSavedContacts(nextContacts); setContacts(nextContacts); setStatus('success');
        }).catch((loadError) => { if (loadError.name !== 'AbortError') { setError(loadError.message); setStatus('error'); } });
        return () => controller.abort();
    }, []);
    useEffect(() => {
        const next = SITE_SETTINGS_SECTIONS.find(({ path }) => path === pathname)?.id ?? 'appearance';
        setSection(next);
    }, [pathname]);
    const themeDirty = Boolean(draft && saved && JSON.stringify(draft) !== JSON.stringify(saved));
    const contactsDirty = Boolean(contacts && savedContacts && JSON.stringify(contacts) !== JSON.stringify(savedContacts));
    const seoDirty = Boolean(seo && savedSeo && JSON.stringify(seo) !== JSON.stringify(savedSeo));
    const { active: sectionDirty, any: dirty } = siteSettingsDirty(section, { appearance: themeDirty, contacts: contactsDirty, seo: seoDirty });
    useEffect(() => { if (!dirty) return undefined; const warn = (event) => { event.preventDefault(); event.returnValue = ''; }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn); }, [dirty]);
    const selectedTheme = useMemo(() => themes.find((theme) => theme.id === draft?.themeId), [themes, draft?.themeId]);
    function clearSaveError() { setSaveStatus((current) => current === 'saving' ? current : 'idle'); setError(''); }
    function updateDraft(change) { clearSaveError(); setDraft((current) => ({ ...current, ...change })); }
    function updateContacts(change) { clearSaveError(); setContacts((current) => ({ ...current, ...change })); }
    function updateToken(palette, token, value) { setDraft((current) => { const nextOverrides = { ...current.overrides, [palette]: { ...current.overrides[palette] } }; const base = palette === 'shared' ? selectedTheme.shared[token] : selectedTheme.palettes[palette][token]; const text = String(value).trim(); if (!text || text === base) delete nextOverrides[palette][token]; else nextOverrides[palette][token] = text; return { ...current, overrides: nextOverrides }; }); }
    function resetToken(palette, token) { setDraft((current) => ({ ...current, overrides: { ...current.overrides, [palette]: Object.fromEntries(Object.entries(current.overrides[palette]).filter(([key]) => key !== token)) } })); }
    async function save() {
        if (saveStatus === 'saving' || !sectionDirty) return;
        if (section === 'seo') {
            if (!seoDirty) return;
            const requestSeo = JSON.stringify(seo);
            setSaveStatus('saving'); setError('');
            try {
                const response = await apiRequest('/api/site/seo', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: requestSeo });
                if (!response.ok) throw new Error(await formResponseError(response, document.getElementById('seo-form'), 'Не удалось сохранить SEO-настройки.'));
                const result = await response.json();
                setSavedSeo(result); setSeo((current) => JSON.stringify(current) === requestSeo ? result : current);
                setSiteData((current) => ({ ...current, seo: result }));
                setSaveStatus('success');
            } catch (error) { setError(error.message); setSaveStatus('error'); }
            return;
        }
        const contactForm = document.getElementById('contact-form');
        const requestTheme = section === 'appearance' && themeDirty ? cloneSettings(draft) : null;
        const requestContacts = section === 'contacts' && contactsDirty ? { ...contacts, socials: [...(contacts.socials ?? [])] } : null;
        const themeFingerprint = requestTheme && JSON.stringify(requestTheme);
        const contactsFingerprint = requestContacts && JSON.stringify(requestContacts);
        setSaveStatus('saving'); setError('');
        try {
            if (requestTheme) {
                const response = await apiRequest('/api/site/theme', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestTheme) });
                const result = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error('Не удалось сохранить оформление. Проверьте значения настроек.');
                const next = cloneSettings(result); setSaved(next); setDraft((current) => JSON.stringify(current) === themeFingerprint ? next : current);
            }
            if (requestContacts) {
                const response = await apiRequest('/api/site/contact', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestContacts) });
                if (!response.ok) throw new Error(await formResponseError(response, contactForm, 'Не удалось сохранить контакты. Проверьте поля и повторите попытку.'));
                const result = await response.json();
                setSavedContacts(result); setContacts((current) => JSON.stringify(current) === contactsFingerprint ? result : current);
            }
            setSaveStatus('success');
        } catch { setError('Не удалось сохранить настройки. Проверьте поля и повторите попытку.'); setSaveStatus('error'); }
    }
    const activeMode = draft?.themeMode;
    const sectionTitle = SITE_SETTINGS_SECTIONS.find(({ id }) => id === section)?.label || 'Оформление';
    const saveAction = section === 'contacts' || section === 'appearance' || section === 'seo'
        ? () => document.getElementById(section === 'contacts' ? 'contact-form' : section === 'seo' ? 'seo-form' : 'appearance-form')?.requestSubmit()
        : undefined;
    return <SiteSettingsLayout title={sectionTitle} list={section === 'catalog'} status={status} errorMessage={error} isDirty={sectionDirty} hasUnsavedChanges={dirty} saveStatus={saveStatus} onSave={saveAction} formId={section === 'contacts' ? 'contact-form' : section === 'appearance' ? 'appearance-form' : section === 'seo' ? 'seo-form' : undefined}>
        {section === 'overview' && <Overview siteData={siteData} />}
        {section === 'contacts' && contacts && <ContactSettings value={contacts} onChange={updateContacts} onSave={save} />}
        {section === 'catalog' && <CatalogEditor />}
        {section === 'seo' && seo && <AdminPanel as="form" id="seo-form" className={styles.contactPanel} onSubmit={(event) => { event.preventDefault(); save(); }}><SeoFields value={seo} onChange={(next) => { clearSaveError(); setSeo(next); }} siteData={siteData} /></AdminPanel>}
        {section === 'appearance' && draft && selectedTheme && <ValidatedForm id="appearance-form" className={styles.content} onSubmit={(event) => { event.preventDefault(); save(); }}>
            <AdminPanel className={styles.panel}>
                <div className={styles.sectionHeading}>
                    <div>
                        <p>{selectedTheme.name}</p>
                    </div>
                    <Button className={styles.resetAll} title="Сбросить все переопределения" aria-label="Сбросить все переопределения" disabled={!Object.keys(draft.overrides.light).length && !Object.keys(draft.overrides.dark).length && !Object.keys(draft.overrides.shared).length} onClick={() => updateDraft({ overrides: { light: {}, dark: {}, shared: {} } })}>
                        <Icon name="restore" /> Сбросить
                    </Button>
                </div>
                <ThemePicker themes={themes} selectedId={draft.themeId} onChange={(themeId) => { if (themeId !== draft.themeId) updateDraft({ themeId, overrides: { light: {}, dark: {}, shared: { ...draft.overrides.shared } } }); }} />
                <ThemeModeControl value={activeMode} onChange={(themeMode) => updateDraft({ themeMode })} />
            </AdminPanel>
            <AdminPanel className={styles.tokensPanel} noPadding>
                <TokenTable theme={selectedTheme} draft={draft} metadata={metadata} disabledPalette={activeMode === 'light' ? 'dark' : activeMode === 'dark' ? 'light' : null} onChange={updateToken} onReset={resetToken} />
            </AdminPanel>
            <AdminPanel>
                <ImageField label="Сепаратор" maxWidth={1600}
                    value={draft.separatorMediaId ? `/api/media/${draft.separatorMediaId}` : ''}
                    onChange={(url) => updateDraft({ separatorMediaId: url ? url.split('/').at(-1) : null })} />
                <p>Используется в разделителях сайта. Без картинки остаётся пустой отступ.</p>
            </AdminPanel>
        </ValidatedForm>}
        {error && status === 'success' && <p className={styles.error} role="alert">{error}</p>}
    </SiteSettingsLayout>;
}
