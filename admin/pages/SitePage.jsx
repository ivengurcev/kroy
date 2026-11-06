import { useContext, useEffect, useMemo, useState } from 'react';
import ApplicationContext from '@vyaz/core/Context.js';
import Button from '../ui/Button.jsx';
import AdminPanel from '../ui/AdminPanel.jsx';
import Icon from '../ui/Icon.jsx';
import TokenControl from '../ui/TokenControls.jsx';
import SocialLinksEditor from '../components/SocialLinksEditor.jsx';
import CatalogEditor from '../components/CatalogEditor.jsx';
import SiteSettingsLayout, { SITE_SETTINGS_SECTIONS } from '../components/SiteSettingsLayout.jsx';
import styles from './SitePage.module.css';
import compactStyles from '../ui/CompactForm.module.css';
import { apiRequest } from '../editor/apiRequest.mjs';
import { formResponseError } from '../ui/formValidation.mjs';
import ValidatedForm from '../ui/ValidatedForm.jsx';

const MODE_OPTIONS = [
    { value: 'light', label: 'Светлая', icon: 'sun' },
    { value: 'dark', label: 'Тёмная', icon: 'moon' },
    { value: 'system', label: 'Системная', icon: 'desktop' },
];
const TOKEN_GROUPS = [
    { id: 'colors', label: 'Цвета', match: (token) => token.startsWith('--site-color-') },
    { id: 'typography', label: 'Типографика', match: (token) => token.startsWith('--site-font-') || token === '--site-line-height' },
    { id: 'geometry', label: 'Геометрия', match: (token) => token.includes('container') || token.includes('radius') },
    { id: 'spacing', label: 'Отступы', match: (token) => token.startsWith('--site-space-') },
];
const SHARED_GROUPS = [
    { id: 'statuses', label: 'Статусы', match: (token) => token.startsWith('--site-color-') },
    { id: 'typography', label: 'Типографика', match: (token) => token.startsWith('--site-font-') || token === '--site-line-height' },
    { id: 'geometry', label: 'Геометрия', match: (token) => token.includes('space-base') || token.includes('radius-base') || token.includes('container') },
];

function cloneSettings(settings) {
    return { themeId: settings.themeId, themeMode: settings.themeMode, overrides: { light: { ...(settings.overrides?.light ?? {}) }, dark: { ...(settings.overrides?.dark ?? {}) }, shared: { ...(settings.overrides?.shared ?? {}) } } };
}

function tokenInfo(token, metadata) {
    if (metadata[token]) return metadata[token];
    if (token.startsWith('--site-space-')) return { label: `Отступ ${token.replace('--site-space-', '')}`, type: 'dimension', units: ['px', 'rem'] };
    return { label: token, type: 'text' };
}

function ThemeThumbnail({ theme, compact = false }) {
    return (
        <span className={`${styles.thumbnail} ${compact ? styles.thumbnailCompact : ''}`} style={{
            '--thumb-light-bg': theme.palettes.light['--site-color-bg'], '--thumb-light-surface': theme.palettes.light['--site-color-bg'], '--thumb-light-text': theme.palettes.light['--site-color-text'], '--thumb-light-accent': theme.palettes.light['--site-color-accent'], '--thumb-light-secondary': theme.palettes.light['--site-color-accent-secondary'], '--thumb-light-soft': theme.palettes.light['--site-color-section-bg'],
            '--thumb-dark-bg': theme.palettes.dark['--site-color-bg'], '--thumb-dark-surface': theme.palettes.dark['--site-color-bg'], '--thumb-dark-text': theme.palettes.dark['--site-color-text'], '--thumb-dark-accent': theme.palettes.dark['--site-color-accent'], '--thumb-dark-secondary': theme.palettes.dark['--site-color-accent-secondary'], '--thumb-dark-soft': theme.palettes.dark['--site-color-section-bg'],
            '--thumb-font': theme.shared['--site-font-body'], '--thumb-radius': theme.shared['--site-radius-base'], '--thumb-space': theme.shared['--site-space-base'],
        }} aria-hidden="true">
            {['light', 'dark'].map((palette) => <span className={`${styles.thumbnailPane} ${palette === 'dark' ? styles.thumbnailDark : ''}`} key={palette}><span className={styles.thumbnailTop} /><span className={styles.thumbnailBody}><span className={styles.thumbnailTitle}>Aa</span><span className={styles.thumbnailLine} /><span className={styles.thumbnailLineShort} /></span></span>)}
        </span>
    );
}

function ThemePicker({ themes, selectedId, onChange }) {
    const selected = themes.find((theme) => theme.id === selectedId) ?? themes[0];
    function selectTheme(event, themeId) { onChange(themeId); event.currentTarget.closest('details')?.removeAttribute('open'); }
    return (
        <details className={styles.themePicker}>
            <summary className={styles.themeSummary}>{selected && <ThemeThumbnail theme={selected} compact />}<span className={styles.themeSummaryText}><strong>{selected?.name ?? 'Тема'}</strong><small>{selected?.description}</small></span><span className={styles.chevron} aria-hidden="true">⌄</span></summary>
            <div className={styles.themeOptions} role="listbox" aria-label="Темы оформления">
                {themes.map((theme) => <button className={`${styles.themeOption} ${theme.id === selectedId ? styles.themeOptionActive : ''}`} type="button" role="option" aria-selected={theme.id === selectedId} key={theme.id} onClick={(event) => selectTheme(event, theme.id)}><ThemeThumbnail theme={theme} /><span><strong>{theme.name}</strong><small>{theme.description}</small></span></button>)}
            </div>
        </details>
    );
}

function TokenTable({ theme, draft, metadata, disabledPalette, onChange, onReset }) {
    const paletteGroups = TOKEN_GROUPS.slice(0, 1).map((group) => ({ ...group, tokens: Object.keys(theme.palettes.light).filter(group.match) })).filter((group) => group.tokens.length);
    const sharedGroups = SHARED_GROUPS.map((group) => ({ ...group, tokens: Object.keys(theme.shared).filter(group.match) })).filter((group) => group.tokens.length);
    const control = (palette, token, baseValue, disabled) => {
        const info = tokenInfo(token, metadata);
        const overridden = draft.overrides[palette][token] !== undefined;
        return <div className={styles.tokenControl}>
            <TokenControl type={info.type} value={draft.overrides[palette][token] ?? baseValue} label={info.label} units={info.units} disabled={disabled} onChange={(value) => onChange(palette, token, value)} />
            {overridden && <button className={styles.resetToken} type="button" title="Вернуть значение темы" aria-label={`Сбросить ${info.label}`} disabled={disabled} onClick={() => onReset(palette, token)}>↶</button>}
        </div>;
    };
    const row = (token, palette) => {
        const info = tokenInfo(token, metadata);
        const base = palette === 'shared' ? theme.shared[token] : theme.palettes[palette][token];
        return <tr key={`${palette}-${token}`}><th scope="row" title={token}>{info.label}</th><td colSpan={palette === 'shared' ? 2 : undefined}>{control(palette, token, base, palette !== 'shared' && disabledPalette === palette)}</td>{palette !== 'shared' && <td>{control('dark', token, theme.palettes.dark[token], disabledPalette === 'dark')}</td>}</tr>;
    };
    return <div className={styles.tokenScroll}>
        <table className={styles.tokenTable}>
            <thead>
                <tr>
                    <th>Токен</th>
                    <th>
                        <span className={styles.paletteHeading}>
                            <Icon name="sun" size={16} /> Светлая
                        </span>
                    </th>
                    <th>
                        <span className={styles.paletteHeading}>
                            <Icon name="moon" size={16} /> Тёмная
                        </span>
                    </th>
                </tr>
            </thead>
            <tbody>{paletteGroups.flatMap((group) => [
                <tr className={styles.groupRow} key={`${group.id}-heading`}>
                    <th colSpan="3">{group.label}</th>
                </tr>,
                ...group.tokens.map((token) => row(token, 'light'))])}{sharedGroups.flatMap((group) => [
                    <tr className={styles.groupRow} key={`${group.id}-heading`}>
                        <th colSpan="3">{group.label}</th>
                    </tr>,
                ...group.tokens.map((token) => row(token, 'shared'))
                ])}
            </tbody>
        </table>
    </div>;
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

function SeoPlaceholder() {
    return <AdminPanel className={styles.placeholder}><h2>SEO</h2><p>Настройки SEO появятся позже.</p></AdminPanel>;
}

export default function SitePage() {
    const { pathname } = useContext(ApplicationContext) || {};
    const [section, setSection] = useState('appearance');
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
    const dirty = themeDirty || contactsDirty;
    useEffect(() => { if (!dirty) return undefined; const warn = (event) => { event.preventDefault(); event.returnValue = ''; }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn); }, [dirty]);
    const selectedTheme = useMemo(() => themes.find((theme) => theme.id === draft?.themeId), [themes, draft?.themeId]);
    function clearSaveError() { setSaveStatus((current) => current === 'saving' ? current : 'idle'); setError(''); }
    function updateDraft(change) { clearSaveError(); setDraft((current) => ({ ...current, ...change })); }
    function updateContacts(change) { clearSaveError(); setContacts((current) => ({ ...current, ...change })); }
    function updateToken(palette, token, value) { setDraft((current) => { const nextOverrides = { ...current.overrides, [palette]: { ...current.overrides[palette] } }; const base = palette === 'shared' ? selectedTheme.shared[token] : selectedTheme.palettes[palette][token]; if (!value.trim() || value === base) delete nextOverrides[palette][token]; else nextOverrides[palette][token] = value; return { ...current, overrides: nextOverrides }; }); }
    function resetToken(palette, token) { setDraft((current) => ({ ...current, overrides: { ...current.overrides, [palette]: Object.fromEntries(Object.entries(current.overrides[palette]).filter(([key]) => key !== token)) } })); }
    async function save() {
        if (saveStatus === 'saving' || !dirty) return;
        const contactForm = document.getElementById('contact-form');
        const requestTheme = themeDirty ? cloneSettings(draft) : null;
        const requestContacts = contactsDirty ? { ...contacts, socials: [...(contacts.socials ?? [])] } : null;
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
    const saveAction = section === 'contacts' || section === 'appearance'
        ? () => document.getElementById(section === 'contacts' ? 'contact-form' : 'appearance-form')?.requestSubmit()
        : undefined;
    return <SiteSettingsLayout title={sectionTitle} list={section === 'catalog'} status={status} errorMessage={error} isDirty={dirty} saveStatus={saveStatus} onSave={saveAction} formId={section === 'contacts' ? 'contact-form' : section === 'appearance' ? 'appearance-form' : undefined}>
        {section === 'overview' && <Overview siteData={siteData} />}
        {section === 'contacts' && contacts && <ContactSettings value={contacts} onChange={updateContacts} onSave={save} />}
        {section === 'catalog' && <CatalogEditor />}
        {section === 'seo' && <SeoPlaceholder />}
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
                <ThemePicker themes={themes} selectedId={draft.themeId} onChange={(themeId) => updateDraft({ themeId })} />
                <div className={styles.modeSwitch} role="group" aria-label="Режим темы">{MODE_OPTIONS.map((option) => <button className={activeMode === option.value ? styles.modeActive : ''} type="button" aria-pressed={activeMode === option.value} title={option.label} key={option.value} onClick={() => updateDraft({ themeMode: option.value })}>
                    <Icon name={option.icon} size={18} />
                    <span>{option.label}</span>
                    </button>)}
                </div>
            </AdminPanel>
            <AdminPanel className={styles.tokensPanel} noPadding>
                <TokenTable theme={selectedTheme} draft={draft} metadata={metadata} disabledPalette={activeMode === 'light' ? 'dark' : activeMode === 'dark' ? 'light' : null} onChange={updateToken} onReset={resetToken} />
            </AdminPanel>
        </ValidatedForm>}
        {error && status === 'success' && <p className={styles.error} role="alert">{error}</p>}
    </SiteSettingsLayout>;
}
