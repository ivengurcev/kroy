import Icon from '../ui/Icon.jsx';
import TokenControl, { SelectControl } from '../ui/TokenControls.jsx';
import styles from '../pages/SitePage.module.css';

export const MODE_OPTIONS = [
    { value: 'light', label: 'Светлая', icon: 'sun' },
    { value: 'dark', label: 'Тёмная', icon: 'moon' },
    { value: 'system', label: 'Системная', icon: 'desktop' },
];

export function ThemeModeControl({ value, onChange, inherit = false }) {
    const options = inherit ? [{ value: '', label: 'Как на сайте', icon: 'restore' }, ...MODE_OPTIONS] : MODE_OPTIONS;
    return <div className={styles.modeSwitch} role="group" aria-label="Режим темы">
        {options.map((option) => <button className={(value ?? '') === option.value ? styles.modeActive : ''} type="button"
            aria-pressed={(value ?? '') === option.value} title={option.label} key={option.value} onClick={() => onChange(option.value || null)}>
            <Icon name={option.icon} size={18} /><span>{option.label}</span>
        </button>)}
    </div>;
}
const SHARED_GROUPS = [
    { id: 'statuses', label: 'Статусы', match: (token) => token.startsWith('--site-color-') },
    { id: 'typography', label: 'Типографика', match: (token) => token.startsWith('--site-font-') || token === '--site-line-height' },
    { id: 'geometry', label: 'Геометрия', match: (token) => token.includes('space-base') || token.includes('radius-base') || token.includes('container') || token === '--site-line-width' },
];

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

export function ThemePicker({ themes, selectedId, onChange, inheritedId }) {
    const options = themes.map((theme) => ({ value: theme.id, label: theme.name, theme }));
    if (inheritedId) options.unshift({ value: '', label: 'Как на сайте', theme: themes.find(({ id }) => id === inheritedId) });
    const choice = (option) => <span className={styles.themeChoice}>
        {option.theme && <ThemeThumbnail theme={option.theme} compact />}
        <span className={styles.themeSummaryText}><strong>{option.label}</strong><small>{option.theme?.description}</small></span>
    </span>;
    return <SelectControl className={styles.themePicker} triggerClassName={styles.themeSummary} label="Тема оформления"
        value={selectedId ?? ''} options={options} onChange={(id) => onChange(id || null)} renderOption={choice} />;
}

export function TokenTable({ theme, draft, metadata, disabledPalette, onChange, onReset, resetLabel = 'Вернуть значение темы' }) {
    const paletteGroups = [{ id: 'colors', label: 'Цвета', tokens: Object.keys(theme.palettes.light).filter((token) => token.startsWith('--site-color-')) }];
    const sharedGroups = SHARED_GROUPS.map((group) => ({ ...group, tokens: Object.keys(theme.shared).filter(group.match) })).filter((group) => group.tokens.length);
    const control = (palette, token, baseValue, disabled) => {
        const info = tokenInfo(token, metadata);
        const overridden = draft.overrides?.[palette]?.[token] !== undefined;
        return <div className={styles.tokenControl}>
            <TokenControl type={info.type} value={draft.overrides?.[palette]?.[token] ?? baseValue} label={info.label} units={info.units} min={info.min} max={info.max} disabled={disabled} compact onChange={(value) => onChange(palette, token, value)} />
            {overridden && <button className={styles.resetToken} type="button" title={resetLabel} aria-label={`Сбросить ${info.label}`} disabled={disabled} onClick={() => onReset(palette, token)}>↶</button>}
        </div>;
    };
    const row = (token, palette) => {
        const info = tokenInfo(token, metadata);
        const base = palette === 'shared' ? theme.shared[token] : theme.palettes[palette][token];
        return <tr key={`${palette}-${token}`}><th scope="row" title={token}>{info.label}</th><td colSpan={palette === 'shared' ? 2 : undefined}>{control(palette, token, base, palette !== 'shared' && disabledPalette === palette)}</td>{palette !== 'shared' && <td>{control('dark', token, theme.palettes.dark[token], disabledPalette === 'dark')}</td>}</tr>;
    };
    return <div className={styles.tokenScroll}>
        <table className={styles.tokenTable} role="table">
            <thead><tr><th>Токен</th><th><span className={styles.paletteHeading}><Icon name="sun" size={16} /> Светлая</span></th><th><span className={styles.paletteHeading}><Icon name="moon" size={16} /> Тёмная</span></th></tr></thead>
            <tbody>{paletteGroups.flatMap((group) => [
                <tr className={styles.groupRow} key={`${group.id}-heading`}><th colSpan="3">{group.label}</th></tr>,
                ...group.tokens.map((token) => row(token, 'light'))])}{sharedGroups.flatMap((group) => [
                <tr className={styles.groupRow} key={`${group.id}-heading`}><th colSpan="3">{group.label}</th></tr>,
                ...group.tokens.map((token) => row(token, 'shared'))
            ])}</tbody>
        </table>
    </div>;
}
