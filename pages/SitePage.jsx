import { useEffect, useMemo, useState } from 'react';
import AdminPageShell from '../components/admin/AdminPageShell.jsx';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import Icon from '../components/ui/Icon.jsx';
import styles from './SitePage.module.css';

const MODE_OPTIONS = [
    { value: 'light', label: 'Светлая', icon: 'sun' },
    { value: 'dark', label: 'Тёмная', icon: 'moon' },
    { value: 'system', label: 'Системная', icon: 'desktop' },
];
const TOKEN_GROUPS = [
    { id: 'colors', label: 'Цвета', match: (token) => token.startsWith('--site-color-') },
    { id: 'typography', label: 'Типографика', match: (token) => token.startsWith('--site-font-') || token === '--site-line-height' },
    { id: 'geometry', label: 'Геометрия', match: (token) => token.includes('container') || token.includes('page-gutter') || token.includes('radius') },
    { id: 'spacing', label: 'Отступы', match: (token) => token.startsWith('--site-space-') },
];
const FONT_OPTIONS = [
    'Arial, Helvetica, sans-serif',
    'Georgia, "Times New Roman", serif',
    'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
];

function cloneSettings(settings) {
    return { themeId: settings.themeId, themeMode: settings.themeMode, overrides: { light: { ...(settings.overrides?.light ?? {}) }, dark: { ...(settings.overrides?.dark ?? {}) } } };
}

function hexColor(value) {
    if (typeof value !== 'string') return '#000000';
    if (/^#[0-9a-f]{6}$/i.test(value)) return value;
    if (/^#[0-9a-f]{8}$/i.test(value)) return value.slice(0, 7);
    const match = value.match(/rgba?\(\s*(\d+)\s*[ ,]\s*(\d+)\s*[ ,]\s*(\d+)(?:\s*\/\s*([\d.]+))?\s*\)/i);
    if (!match) return '#000000';
    return `#${match.slice(1, 4).map((channel) => Math.max(0, Math.min(255, Number(channel))).toString(16).padStart(2, '0')).join('')}`;
}

function parseDimension(value) {
    const match = typeof value === 'string' && value.trim().match(/^(-?(?:\d+\.?\d*|\.\d+))(px|rem|em|vw|vh|%)?$/);
    return match ? { number: match[1], unit: match[2] || '' } : null;
}

function tokenInfo(token, metadata) {
    if (metadata[token]) return metadata[token];
    if (token.startsWith('--site-space-')) return { label: `Отступ ${token.replace('--site-space-', '')}`, type: 'dimension', units: ['px', 'rem'] };
    return { label: token, type: 'text' };
}

function ThemeThumbnail({ theme, compact = false }) {
    return (
        <span className={`${styles.thumbnail} ${compact ? styles.thumbnailCompact : ''}`} style={{
            '--thumb-light-bg': theme.tokens.light['--site-color-bg'], '--thumb-light-surface': theme.tokens.light['--site-color-surface'], '--thumb-light-text': theme.tokens.light['--site-color-text'], '--thumb-light-accent': theme.tokens.light['--site-color-accent'], '--thumb-light-soft': theme.tokens.light['--site-color-surface-soft'],
            '--thumb-dark-bg': theme.tokens.dark['--site-color-bg'], '--thumb-dark-surface': theme.tokens.dark['--site-color-surface'], '--thumb-dark-text': theme.tokens.dark['--site-color-text'], '--thumb-dark-accent': theme.tokens.dark['--site-color-accent'], '--thumb-dark-soft': theme.tokens.dark['--site-color-surface-soft'],
            '--thumb-font': theme.tokens.light['--site-font-body'], '--thumb-radius': theme.tokens.light['--site-radius-md'] || theme.tokens.light['--site-space-2'], '--thumb-space': theme.tokens.light['--site-space-2'],
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

function TokenControl({ palette, token, baseValue, overrideValue, info, disabled, onChange, onReset }) {
    const effectiveValue = overrideValue ?? baseValue;
    const [draftValue, setDraftValue] = useState(effectiveValue);
    const [focused, setFocused] = useState(false);
    const overridden = overrideValue !== undefined;
    const dimension = parseDimension(effectiveValue);
    const hasExpression = !dimension && (info.type === 'dimension' || info.type === 'number');
    useEffect(() => { if (!focused) setDraftValue(effectiveValue); }, [effectiveValue, focused]);
    function changeValue(value) { setDraftValue(value); onChange(palette, token, value); }
    function changeDimensionNumber(value) { const current = parseDimension(draftValue) || parseDimension(baseValue) || { unit: info.units?.[0] || '' }; changeValue(value === '' ? '' : `${value}${current.unit}`); }
    function changeDimensionUnit(unit) { const current = parseDimension(draftValue) || parseDimension(baseValue); if (current) changeValue(`${current.number}${unit}`); }
    const reset = overridden && <button className={styles.resetToken} type="button" title="Вернуть значение темы" aria-label={`Сбросить ${info.label}`} disabled={disabled} onClick={() => onReset(palette, token)}>↶</button>;
    if (info.type === 'color') {
        const value = hexColor(draftValue);
        return <div className={styles.tokenControl}><input className={styles.colorPicker} type="color" value={value} disabled={disabled} title={`Выбрать цвет: ${info.label}`} onChange={(event) => changeValue(event.target.value)} /><input className={styles.colorHex} value={focused ? draftValue : value} disabled={disabled} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onChange={(event) => { const next = event.target.value; setDraftValue(next); if (next === '' || /^#[0-9a-f]{0,8}$/i.test(next)) onChange(palette, token, next); }} aria-label={`${info.label}, HEX`} />{reset}</div>;
    }
    if (info.type === 'font') {
        const options = FONT_OPTIONS.includes(effectiveValue) ? FONT_OPTIONS : [effectiveValue, ...FONT_OPTIONS];
        return <div className={styles.tokenControl}><select value={effectiveValue} disabled={disabled} style={{ fontFamily: effectiveValue }} title={info.label} onChange={(event) => changeValue(event.target.value)}>{options.map((font) => <option value={font} key={font}>{font.split(',')[0]}</option>)}</select>{reset}</div>;
    }
    if (info.type === 'dimension' && hasExpression) return <input className={styles.expressionValue} value={effectiveValue} readOnly disabled={disabled} title="Адаптивное значение задаётся внутренними стилями" />;
    if (info.type === 'dimension' || info.type === 'number') {
        const parsed = dimension || { number: '', unit: info.units?.[0] || '' };
        return <div className={styles.tokenControl}><input className={styles.dimensionNumber} type="number" step={info.type === 'number' ? '0.05' : '1'} value={focused ? (parseDimension(draftValue)?.number ?? '') : parsed.number} disabled={disabled} title={info.label} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onChange={(event) => changeDimensionNumber(event.target.value)} />{info.type === 'dimension' && <select className={styles.dimensionUnit} value={parsed.unit} disabled={disabled} title="Единица измерения" onChange={(event) => changeDimensionUnit(event.target.value)}>{info.units.map((unit) => <option value={unit} key={unit}>{unit}</option>)}</select>}{reset}</div>;
    }
    return <div className={styles.tokenControl}><input value={draftValue} disabled={disabled} title={info.label} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onChange={(event) => !/[()]|\b(?:clamp|calc|var|min|max)\s*\(/i.test(event.target.value) && changeValue(event.target.value)} />{reset}</div>;
}

function TokenTable({ theme, draft, metadata, disabledPalette, onChange, onReset }) {
    const tokens = Object.keys(theme.tokens.light);
    const groups = TOKEN_GROUPS.map((group) => ({ ...group, tokens: tokens.filter(group.match) })).filter((group) => group.tokens.length);
    return <div className={styles.tokenScroll}><table className={styles.tokenTable}><thead><tr><th>Токен</th><th><span className={styles.paletteHeading}><Icon name="sun" size={16} /> Светлая</span></th><th><span className={styles.paletteHeading}><Icon name="moon" size={16} /> Тёмная</span></th></tr></thead><tbody>{groups.flatMap((group) => [<tr className={styles.groupRow} key={`${group.id}-heading`}><th colSpan="3">{group.label}</th></tr>, ...group.tokens.map((token) => { const info = tokenInfo(token, metadata); return <tr key={token}><th scope="row" title={token}>{info.label}</th><td><TokenControl palette="light" token={token} baseValue={theme.tokens.light[token]} overrideValue={draft.overrides.light[token]} info={info} disabled={disabledPalette === 'light'} onChange={onChange} onReset={onReset} /></td><td><TokenControl palette="dark" token={token} baseValue={theme.tokens.dark[token]} overrideValue={draft.overrides.dark[token]} info={info} disabled={disabledPalette === 'dark'} onChange={onChange} onReset={onReset} /></td></tr>; })])}</tbody></table></div>;
}

export default function SitePage() {
    const [themes, setThemes] = useState([]); const [metadata, setMetadata] = useState({}); const [saved, setSaved] = useState(null); const [draft, setDraft] = useState(null); const [status, setStatus] = useState('loading'); const [saveStatus, setSaveStatus] = useState('idle'); const [error, setError] = useState('');
    useEffect(() => { const controller = new AbortController(); fetch('/api/site/theme', { signal: controller.signal }).then(async (response) => { if (!response.ok) throw new Error('Не удалось загрузить настройки оформления.'); return response.json(); }).then(({ themes: nextThemes, metadata: nextMetadata, settings }) => { const next = cloneSettings(settings); setThemes(nextThemes); setMetadata(nextMetadata || {}); setSaved(next); setDraft(next); setStatus('success'); }).catch((loadError) => { if (loadError.name !== 'AbortError') { setError(loadError.message); setStatus('error'); } }); return () => controller.abort(); }, []);
    const dirty = Boolean(draft && saved && JSON.stringify(draft) !== JSON.stringify(saved));
    useEffect(() => { if (!dirty) return undefined; const warn = (event) => { event.preventDefault(); event.returnValue = ''; }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn); }, [dirty]);
    const selectedTheme = useMemo(() => themes.find((theme) => theme.id === draft?.themeId), [themes, draft?.themeId]);
    function updateDraft(change) { setDraft((current) => ({ ...current, ...change })); }
    function updateToken(palette, token, value) { setDraft((current) => { const nextOverrides = { ...current.overrides, [palette]: { ...current.overrides[palette] } }; if (!value.trim() || value === selectedTheme.tokens[palette][token]) delete nextOverrides[palette][token]; else nextOverrides[palette][token] = value; return { ...current, overrides: nextOverrides }; }); }
    function resetToken(palette, token) { setDraft((current) => ({ ...current, overrides: { ...current.overrides, [palette]: Object.fromEntries(Object.entries(current.overrides[palette]).filter(([key]) => key !== token)) } })); }
    async function save() { if (!draft || saveStatus === 'saving' || !dirty) return; setSaveStatus('saving'); setError(''); try { const response = await fetch('/api/site/theme', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft) }); const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(result.error || 'Не удалось сохранить оформление.'); const next = cloneSettings(result); setSaved(next); setDraft(next); setSaveStatus('success'); } catch (saveError) { setError(saveError.message); setSaveStatus('error'); } }
    const activeMode = draft?.themeMode;
    return <AdminPageShell headerMode="site" title="Оформление" status={status} errorMessage={error} actions={<Button variant="primary" title="Сохранить настройки оформления" disabled={!dirty || saveStatus === 'saving'} onClick={save}>{saveStatus === 'saving' ? 'Сохранение…' : 'Сохранить'}</Button>}>
        {draft && selectedTheme && <div className={styles.content}><Card className={styles.panel}><div className={styles.sectionHeading}><div><h2>Оформление</h2><p>{selectedTheme.name}</p></div><Button className={styles.resetAll} title="Сбросить все переопределения" aria-label="Сбросить все переопределения" disabled={!Object.keys(draft.overrides.light).length && !Object.keys(draft.overrides.dark).length} onClick={() => updateDraft({ overrides: { light: {}, dark: {} } })}><Icon name="restore" /> Сбросить</Button></div><ThemePicker themes={themes} selectedId={draft.themeId} onChange={(themeId) => updateDraft({ themeId })} /><div className={styles.modeSwitch} role="group" aria-label="Режим темы">{MODE_OPTIONS.map((option) => <button className={activeMode === option.value ? styles.modeActive : ''} type="button" aria-pressed={activeMode === option.value} title={option.label} key={option.value} onClick={() => updateDraft({ themeMode: option.value })}><Icon name={option.icon} size={18} /><span>{option.label}</span></button>)}</div></Card><Card className={styles.tokensPanel}><TokenTable theme={selectedTheme} draft={draft} metadata={metadata} disabledPalette={activeMode === 'light' ? 'dark' : activeMode === 'dark' ? 'light' : null} onChange={updateToken} onReset={resetToken} /></Card>{error && <p className={styles.error} role="alert">{error}</p>}</div>}
    </AdminPageShell>;
}
