import { useEffect, useRef, useState } from 'react';
import styles from './TokenControls.module.css';

export const FONT_OPTIONS = [
    'Arial, Helvetica, sans-serif',
    'Georgia, "Times New Roman", serif',
    'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    'Inter, ui-sans-serif, system-ui, sans-serif',
    '"Segoe UI", Arial, sans-serif',
    'Roboto, Arial, sans-serif',
    '"Helvetica Neue", Arial, sans-serif',
    'Verdana, Geneva, sans-serif',
    'Tahoma, Geneva, sans-serif',
    '"Trebuchet MS", Arial, sans-serif',
    '"Courier New", monospace',
    '"Palatino Linotype", "Book Antiqua", Palatino, serif',
];

function hexColor(value) {
    if (typeof value !== 'string') return '#000000ff';
    if (/^#[0-9a-f]{6}$/i.test(value)) return `${value}ff`;
    if (/^#[0-9a-f]{8}$/i.test(value)) return value.toLowerCase();
    const match = value.match(/rgba?\(\s*(\d+)\s*[ ,]\s*(\d+)\s*[ ,]\s*(\d+)(?:\s*[/,]\s*([\d.]+))?\s*\)/i);
    if (!match) return '#000000ff';
    const channels = match.slice(1, 4).map((channel) => Math.max(0, Math.min(255, Number(channel))).toString(16).padStart(2, '0'));
    const alpha = match[4] === undefined ? 'ff' : Math.round(Math.max(0, Math.min(1, Number(match[4]))) * 255).toString(16).padStart(2, '0');
    return `#${channels.join('')}${alpha}`;
}

function parseDimension(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return { number: String(value), unit: '' };
    const match = typeof value === 'string' && value.trim().match(/^(-?(?:\d+\.?\d*|\.\d+))(px|rem|em|vw|vh|%)?$/);
    return match ? { number: match[1], unit: match[2] || '' } : null;
}

export function ColorControl({ value, disabled = false, label, onChange }) {
    const committed = hexColor(value);
    const [draft, setDraft] = useState(committed);
    const [focused, setFocused] = useState(false);
    useEffect(() => { if (!focused) setDraft(committed); }, [committed, focused]);
    function commit(next) {
        const normalized = hexColor(next);
        setDraft(normalized);
        onChange(normalized);
    }
    function handleText(event) {
        const next = event.target.value;
        setDraft(next);
        if (/^#[0-9a-f]{6}$/i.test(next) || /^#[0-9a-f]{8}$/i.test(next)) commit(next);
    }
    return <div className={styles.control}>
        <input className={styles.colorPicker} type="color" value={committed.slice(0, 7)} disabled={disabled} title={label} onChange={(event) => commit(event.target.value)} />
        <input className={`${styles.input} ${styles.colorHex}`} value={focused ? draft : committed} disabled={disabled} aria-label={`${label}, HEX8`} onFocus={() => setFocused(true)} onBlur={() => { setFocused(false); setDraft(committed); }} onChange={handleText} />
    </div>;
}

export function DimensionControl({ value, type = 'dimension', units = ['px'], numeric = false, disabled = false, label, onChange }) {
    const [draft, setDraft] = useState(value ?? '');
    const [focused, setFocused] = useState(false);
    const parsed = parseDimension(value);
    const hasExpression = !parsed && type === 'dimension';
    useEffect(() => { if (!focused) setDraft(value ?? ''); }, [value, focused]);
    if (hasExpression) return <input className={`${styles.input} ${styles.expression}`} value={value ?? ''} readOnly disabled={disabled} title="Адаптивное значение задаётся внутренними стилями" />;
    const current = parseDimension(draft) || parsed || { number: '', unit: units[0] || '' };
    function commitNumber(next) {
        setDraft(next === '' ? '' : `${next}${current.unit}`);
        if (next !== '') onChange(numeric ? Number(next) : `${next}${current.unit}`);
    }
    function commitUnit(unit) {
        const next = parseDimension(draft) || parsed;
        if (next) { const result = `${next.number}${unit}`; setDraft(result); onChange(result); }
    }
    return <div className={styles.control}>
        <input className={styles.input} type="number" step={type === 'number' ? '0.05' : '1'} value={focused ? (parseDimension(draft)?.number ?? '') : current.number} disabled={disabled} title={label} onFocus={() => setFocused(true)} onBlur={() => { setFocused(false); setDraft(value ?? ''); }} onChange={(event) => commitNumber(event.target.value)} />
        {type === 'dimension' && <select className={styles.input} value={current.unit} disabled={disabled} title="Единица измерения" onChange={(event) => commitUnit(event.target.value)}>{units.map((unit) => <option value={unit} key={unit}>{unit}</option>)}</select>}
    </div>;
}

export function FontControl({ value, disabled = false, label, onChange, options = FONT_OPTIONS }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    const allOptions = options.includes(value) ? options : [value, ...options];
    useEffect(() => {
        if (!open) return undefined;
        const close = (event) => { if (!ref.current?.contains(event.target)) setOpen(false); };
        const escape = (event) => { if (event.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', close); document.addEventListener('keydown', escape);
        return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', escape); };
    }, [open]);
    return <div className={styles.control}><div className={styles.fontMenu} ref={ref}>
        <button className={styles.trigger} type="button" disabled={disabled} title={label} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)}><span style={{ fontFamily: value }}>{value?.split(',')[0]}</span><span aria-hidden="true">⌄</span></button>
        {open && <div className={styles.menu} role="listbox" aria-label={label}>{allOptions.map((option) => <button className={styles.option} type="button" role="option" aria-selected={option === value} style={{ fontFamily: option }} key={option} onClick={() => { onChange(option); setOpen(false); }}>{option.split(',')[0]}</button>)}</div>}
    </div></div>;
}

export default function TokenControl({ type, value, disabled, label, units, numeric = false, onChange }) {
    if (type === 'color') return <ColorControl value={value} disabled={disabled} label={label} onChange={onChange} />;
    if (type === 'font') return <FontControl value={value} disabled={disabled} label={label} onChange={onChange} />;
    if (type === 'dimension' || type === 'number') return <DimensionControl value={value} type={type} units={units} numeric={numeric} disabled={disabled} label={label} onChange={onChange} />;
    return <input className={styles.input} value={value ?? ''} disabled={disabled} title={label} onChange={(event) => onChange(event.target.value)} />;
}
