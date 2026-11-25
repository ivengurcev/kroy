import { useEffect, useId, useRef, useState } from 'react';
import styles from './TokenControls.module.css';
import '../../site/styles/fonts.css';

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
    '"Yeseva One", Georgia, serif',
    'Oswald, Arial, sans-serif',
    '"Roboto Condensed", Arial, sans-serif',
    'Caveat, cursive',
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

export function ColorControl({ value, disabled = false, label, onChange, compact = false }) {
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
    return <div className={`${styles.control} ${compact ? styles.compactColor : ''}`}>
        <input className={styles.colorPicker} type="color" value={committed.slice(0, 7)} disabled={disabled} title={label} onChange={(event) => commit(event.target.value)} />
        <input className={`${styles.input} ${styles.colorHex}`} value={focused ? draft : committed} disabled={disabled} aria-label={`${label}, HEX8`} onFocus={() => setFocused(true)} onBlur={() => { setFocused(false); setDraft(committed); }} onChange={handleText} />
    </div>;
}

export function DimensionControl({ value, type = 'dimension', units = ['px'], numeric = false, min, max, disabled = false, label, onChange }) {
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
        <input className={styles.input} type="number" step={type === 'number' ? '0.05' : '1'} min={min} max={max} value={focused ? (parseDimension(draft)?.number ?? '') : current.number} disabled={disabled} title={label} onFocus={() => setFocused(true)} onBlur={() => { setFocused(false); setDraft(value ?? ''); }} onChange={(event) => commitNumber(event.target.value)} />
        {type === 'dimension' && <SelectControl value={current.unit} disabled={disabled} label="Единица измерения" size="small" options={units} onChange={commitUnit} />}
    </div>;
}

export function SelectControl({ value = '', disabled = false, label, onChange, options = [], name, required = false, size = 'medium', renderOption, renderValue = renderOption, className = '', triggerClassName = '', menuClassName = '' }) {
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);
    const ref = useRef(null);
    const trigger = useRef(null);
    const native = useRef(null);
    const id = useId();
    const choices = options.map((option) => typeof option === 'string' ? { value: option, label: option } : option);
    const selectedIndex = choices.findIndex((option) => option.value === value);
    const selected = choices[selectedIndex];
    const expanded = open && !disabled;
    useEffect(() => {
        if (!expanded) return undefined;
        const close = (event) => { if (!ref.current?.contains(event.target)) setOpen(false); };
        document.addEventListener('pointerdown', close);
        return () => document.removeEventListener('pointerdown', close);
    }, [expanded]);
    useEffect(() => {
        if (expanded) ref.current?.querySelector(`[id="${CSS.escape(`${id}-${active}`)}"]`)?.scrollIntoView?.({ block: 'nearest' });
    }, [expanded, active, id]);
    function choose(index) {
        const option = choices[index];
        if (!option || option.disabled) return;
        onChange(option.value);
        setOpen(false);
        trigger.current?.removeAttribute('aria-invalid');
        trigger.current?.removeAttribute('aria-errormessage');
        native.current?.dispatchEvent(new Event('input', { bubbles: true }));
        trigger.current?.focus();
    }
    function nextOption(index, direction) {
        for (let count = 0; count < choices.length; count++) {
            index = (index + direction + choices.length) % choices.length;
            if (!choices[index].disabled) return index;
        }
        return -1;
    }
    function handleKeyDown(event) {
        if (disabled || !choices.length) return;
        if (event.key === 'Escape' && expanded) {
            event.preventDefault(); event.stopPropagation(); setOpen(false);
        } else if (event.key === 'Tab') setOpen(false);
        else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
            event.preventDefault();
            const direction = event.key === 'ArrowUp' || event.key === 'End' ? -1 : 1;
            const start = event.key === 'Home' ? -1 : event.key === 'End' ? choices.length : expanded ? active : selectedIndex;
            setActive(nextOption(start, direction));
            setOpen(true);
        } else if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            if (expanded) choose(active);
            else { setActive(selectedIndex >= 0 ? selectedIndex : nextOption(-1, 1)); setOpen(true); }
        } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
            const match = choices.findIndex((option) => !option.disabled && option.label.toLowerCase().startsWith(event.key.toLowerCase()));
            if (match >= 0) { event.preventDefault(); setActive(match); setOpen(true); }
        }
    }
    return <span className={`${styles.select} ${size === 'small' ? styles.smallSelect : ''} ${className}`} ref={ref} data-validation-group onKeyDown={handleKeyDown}>
        {(name || required) && <select ref={native} className={styles.nativeSelect} name={name} required={required} value={value} disabled={disabled} tabIndex={-1} aria-hidden="true"
            onChange={(event) => choose(choices.findIndex((option) => option.value === event.target.value))}
            onFocus={(event) => {
                for (const attribute of ['aria-invalid', 'aria-errormessage']) {
                    const value = event.currentTarget.getAttribute(attribute);
                    if (value) trigger.current?.setAttribute(attribute, value);
                }
                trigger.current?.focus();
            }}>
            {choices.map((option) => <option value={option.value} key={option.value} disabled={option.disabled}>{option.label}</option>)}
        </select>}
        <button ref={trigger} className={`${styles.trigger} ${triggerClassName}`} type="button" disabled={disabled} title={label} aria-label={label}
            role="combobox" aria-haspopup="listbox" aria-expanded={expanded} aria-controls={`${id}-list`} aria-required={required || undefined}
            aria-activedescendant={expanded && active >= 0 ? `${id}-${active}` : undefined}
            onClick={() => { setActive(selectedIndex >= 0 ? selectedIndex : nextOption(-1, 1)); setOpen(!expanded); }}>
            <span className={styles.selectedValue}>{selected ? renderValue?.(selected) ?? selected.label : 'Выбрать…'}</span><span aria-hidden="true">⌄</span>
        </button>
        {expanded && <span className={`${styles.menu} ${menuClassName}`} id={`${id}-list`} role="listbox" aria-label={label}>
            {choices.map((option, index) => <button id={`${id}-${index}`} className={`${styles.option} ${index === active ? styles.activeOption : ''}`} type="button" role="option" aria-selected={option.value === value} disabled={option.disabled} tabIndex={-1} key={option.value} onPointerMove={() => { if (!option.disabled) setActive(index); }} onClick={() => choose(index)}>{renderOption?.(option) ?? option.label}</button>)}
        </span>}
    </span>;
}

export function FontControl({ value, disabled = false, label, onChange, options = FONT_OPTIONS }) {
    const allOptions = options.includes(value) ? options : [value, ...options];
    return <SelectControl value={value} disabled={disabled} label={label} size="small" onChange={onChange}
        options={allOptions.map((option) => ({ value: option, label: option?.split(',')[0] ?? '' }))}
        renderOption={(option) => <span style={{ fontFamily: option.value }}>{option.label}</span>} />;
}

export default function TokenControl({ type, value, disabled, label, units, numeric = false, min, max, onChange, compact = false }) {
    if (type === 'color') return <ColorControl value={value} disabled={disabled} label={label} onChange={onChange} compact={compact} />;
    if (type === 'font') return <FontControl value={value} disabled={disabled} label={label} onChange={onChange} />;
    if (type === 'dimension' || type === 'number') return <DimensionControl value={value} type={type} units={units} numeric={numeric} min={min} max={max} disabled={disabled} label={label} onChange={onChange} />;
    return <input className={styles.input} value={value ?? ''} disabled={disabled} title={label} onChange={(event) => onChange(event.target.value)} />;
}
