import { useEffect, useMemo, useState } from 'react';
import AdminPageShell from '../components/admin/AdminPageShell.jsx';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import FormField from '../components/ui/FormField.jsx';
import styles from './SitePage.module.css';

const MODE_LABELS = {
    light: 'Светлая',
    dark: 'Тёмная',
    system: 'Системная',
};

const TOKEN_GROUPS = [
    { id: 'colors', label: 'Цвета', match: (token) => token.startsWith('--site-color-') },
    { id: 'typography', label: 'Типографика', match: (token) => token.startsWith('--site-font-') || token === '--site-line-height' },
    { id: 'geometry', label: 'Геометрия', match: (token) => token.includes('container') || token.includes('page-gutter') },
    { id: 'spacing', label: 'Отступы', match: (token) => token.startsWith('--site-space-') },
];

function cloneSettings(settings) {
    return {
        themeId: settings.themeId,
        themeMode: settings.themeMode,
        overrides: {
            light: { ...(settings.overrides?.light ?? {}) },
            dark: { ...(settings.overrides?.dark ?? {}) },
        },
    };
}

function tokenLabel(token) {
    return token
        .replace(/^--site-/, '')
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function ThemeThumbnail({ theme, palette = 'light', compact = false }) {
    const palettes = palette === 'both' ? ['light', 'dark'] : [palette];
    return (
        <span
            className={`${styles.thumbnail} ${compact ? styles.thumbnailCompact : ''}`}
            style={{
                '--thumb-light-bg': theme.tokens.light['--site-color-bg'],
                '--thumb-light-surface': theme.tokens.light['--site-color-surface'],
                '--thumb-light-text': theme.tokens.light['--site-color-text'],
                '--thumb-light-accent': theme.tokens.light['--site-color-accent'],
                '--thumb-light-soft': theme.tokens.light['--site-color-surface-soft'],
                '--thumb-dark-bg': theme.tokens.dark['--site-color-bg'],
                '--thumb-dark-surface': theme.tokens.dark['--site-color-surface'],
                '--thumb-dark-text': theme.tokens.dark['--site-color-text'],
                '--thumb-dark-accent': theme.tokens.dark['--site-color-accent'],
                '--thumb-dark-soft': theme.tokens.dark['--site-color-surface-soft'],
                '--thumb-font': theme.tokens.light['--site-font-body'],
                '--thumb-radius': theme.tokens.light['--site-space-2'],
                '--thumb-space': theme.tokens.light['--site-space-2'],
            }}
            aria-hidden="true"
        >
            {palettes.map((currentPalette) => (
                <span className={`${styles.thumbnailPane} ${currentPalette === 'dark' ? styles.thumbnailDark : ''}`} key={currentPalette}>
                    <span className={styles.thumbnailTop} />
                    <span className={styles.thumbnailBody}>
                        <span className={styles.thumbnailTitle}>Aa</span>
                        <span className={styles.thumbnailLine} />
                        <span className={styles.thumbnailLineShort} />
                    </span>
                </span>
            ))}
        </span>
    );
}

function ThemePicker({ themes, selectedId, onChange }) {
    const selected = themes.find((theme) => theme.id === selectedId) ?? themes[0];
    return (
        <details className={styles.themePicker}>
            <summary className={styles.themeSummary}>
                {selected && <ThemeThumbnail theme={selected} compact />}
                <span>
                    <strong>{selected?.name ?? 'Тема'}</strong>
                    <small>{selected?.description}</small>
                </span>
            </summary>
            <div className={styles.themeOptions} role="listbox" aria-label="Темы оформления">
                {themes.map((theme) => (
                    <button
                        className={`${styles.themeOption} ${theme.id === selectedId ? styles.themeOptionActive : ''}`}
                        type="button"
                        role="option"
                        aria-selected={theme.id === selectedId}
                        key={theme.id}
                        onClick={() => onChange(theme.id)}
                    >
                        <ThemeThumbnail theme={theme} palette="both" />
                        <span>
                            <strong>{theme.name}</strong>
                            <small>{theme.description}</small>
                        </span>
                    </button>
                ))}
            </div>
        </details>
    );
}

function TokenColumn({ palette, tokens, theme, draft, disabled, onChange, onReset }) {
    const groups = TOKEN_GROUPS.map((group) => ({
        ...group,
        tokens: Object.keys(tokens).filter(group.match),
    })).filter((group) => group.tokens.length > 0);

    return (
        <section className={`${styles.palette} ${disabled ? styles.paletteDisabled : ''}`} aria-label={`${palette === 'light' ? 'Светлая' : 'Тёмная'} палитра`}>
            <h3>{palette === 'light' ? 'Светлая' : 'Тёмная'}</h3>
            {groups.map((group) => (
                <fieldset className={styles.tokenGroup} key={group.id} disabled={disabled}>
                    <legend>{group.label}</legend>
                    {group.tokens.map((token) => {
                        const baseValue = tokens[token];
                        const value = draft.overrides[palette][token] ?? baseValue;
                        const overridden = Object.hasOwn(draft.overrides[palette], token);
                        return (
                            <div className={styles.tokenRow} key={token}>
                                <FormField label={tokenLabel(token)}>
                                    <input
                                        value={value}
                                        onChange={(event) => onChange(palette, token, event.target.value)}
                                        title={token}
                                    />
                                </FormField>
                                {overridden && (
                                    <button
                                        className={styles.resetToken}
                                        type="button"
                                        title="Вернуть значение темы"
                                        aria-label={`Вернуть значение темы для ${tokenLabel(token)}`}
                                        onClick={() => onReset(palette, token)}
                                    >
                                        ↶
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </fieldset>
            ))}
        </section>
    );
}

export default function SitePage() {
    const [themes, setThemes] = useState([]);
    const [saved, setSaved] = useState(null);
    const [draft, setDraft] = useState(null);
    const [status, setStatus] = useState('loading');
    const [saveStatus, setSaveStatus] = useState('idle');
    const [error, setError] = useState('');

    useEffect(() => {
        const controller = new AbortController();
        fetch('/api/site/theme', { signal: controller.signal })
            .then(async (response) => {
                if (!response.ok) throw new Error('Не удалось загрузить настройки оформления.');
                return response.json();
            })
            .then(({ themes: nextThemes, settings }) => {
                const next = cloneSettings(settings);
                setThemes(nextThemes);
                setSaved(next);
                setDraft(next);
                setStatus('success');
            })
            .catch((loadError) => {
                if (loadError.name !== 'AbortError') {
                    setError(loadError.message);
                    setStatus('error');
                }
            });
        return () => controller.abort();
    }, []);

    const dirty = Boolean(draft && saved && JSON.stringify(draft) !== JSON.stringify(saved));
    useEffect(() => {
        if (!dirty) return undefined;
        const warn = (event) => {
            event.preventDefault();
            event.returnValue = '';
        };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [dirty]);

    const selectedTheme = useMemo(
        () => themes.find((theme) => theme.id === draft?.themeId),
        [themes, draft?.themeId],
    );

    function updateDraft(change) {
        setDraft((current) => ({ ...current, ...change }));
    }

    function updateToken(palette, token, value) {
        setDraft((current) => {
            const nextOverrides = {
                ...current.overrides,
                [palette]: { ...current.overrides[palette] },
            };
            const baseValue = selectedTheme.tokens[palette][token];
            if (!value.trim() || value === baseValue) delete nextOverrides[palette][token];
            else nextOverrides[palette][token] = value;
            return { ...current, overrides: nextOverrides };
        });
    }

    function resetToken(palette, token) {
        setDraft((current) => {
            const nextOverrides = {
                ...current.overrides,
                [palette]: { ...current.overrides[palette] },
            };
            delete nextOverrides[palette][token];
            return { ...current, overrides: nextOverrides };
        });
    }

    async function save() {
        if (!draft || saveStatus === 'saving' || !dirty) return;
        setSaveStatus('saving');
        setError('');
        try {
            const response = await fetch('/api/site/theme', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(draft),
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result.error || 'Не удалось сохранить оформление.');
            const next = cloneSettings(result);
            setSaved(next);
            setDraft(next);
            setSaveStatus('success');
        } catch (saveError) {
            setError(saveError.message);
            setSaveStatus('error');
        }
    }

    const actions = (
        <Button variant="primary" title="Сохранить настройки оформления" disabled={!dirty || saveStatus === 'saving'} onClick={save}>
            {saveStatus === 'saving' ? 'Сохранение…' : 'Сохранить'}
        </Button>
    );

    return (
        <AdminPageShell title="Оформление" actions={actions} status={status} errorMessage={error}>
            {draft && selectedTheme && (
                <div className={styles.content}>
                    <Card className={styles.panel}>
                        <div className={styles.sectionHeading}>
                            <div>
                                <h2>Оформление сайта</h2>
                                <p>Выберите тему и настройте значения для светлой и тёмной палитры.</p>
                            </div>
                            <Button title="Сбросить все переопределения" disabled={!Object.keys(draft.overrides.light).length && !Object.keys(draft.overrides.dark).length} onClick={() => updateDraft({ overrides: { light: {}, dark: {} } })}>
                                Сбросить переопределения
                            </Button>
                        </div>

                        <ThemePicker themes={themes} selectedId={draft.themeId} onChange={(themeId) => updateDraft({ themeId })} />

                        <FormField label="Режим темы">
                            <select value={draft.themeMode} onChange={(event) => updateDraft({ themeMode: event.target.value })}>
                                {Object.entries(MODE_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                            </select>
                        </FormField>
                    </Card>

                    <div className={styles.palettes}>
                        <TokenColumn palette="light" tokens={selectedTheme.tokens.light} theme={selectedTheme} draft={draft} disabled={draft.themeMode === 'dark'} onChange={updateToken} onReset={resetToken} />
                        <TokenColumn palette="dark" tokens={selectedTheme.tokens.dark} theme={selectedTheme} draft={draft} disabled={draft.themeMode === 'light'} onChange={updateToken} onReset={resetToken} />
                    </div>

                    {error && <p className={styles.error} role="alert">{error}</p>}
                </div>
            )}
        </AdminPageShell>
    );
}
