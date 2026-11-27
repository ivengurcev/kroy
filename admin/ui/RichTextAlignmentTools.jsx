import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $addUpdateTag, $getSelection, $isRangeSelection, $setSelection, FORMAT_ELEMENT_COMMAND, HISTORY_PUSH_TAG } from 'lexical';
import Button from './Button.jsx';
import Icon from './Icon.jsx';
import ToolbarButton from './RichTextToolbarButton.jsx';
import { $readToolbarState } from './richTextToolbar.mjs';
import { EXTERNAL_RICHTEXT_TAG } from './richTextState.mjs';
import styles from './RichTextEditor.module.css';

const options = [
    ['left', 'По левому краю', 'alignLeft'],
    ['center', 'По центру', 'alignCenter'],
    ['right', 'По правому краю', 'alignRight'],
    ['justify', 'По ширине', 'alignJustify'],
];

export default function RichTextAlignmentTools({ selection, alignment = 'left', disabled }) {
    const [editor] = useLexicalComposerContext();
    const [context, setContext] = useState(null);
    const trigger = useRef(null);
    const popup = useRef(null);
    const id = useId();
    const anchor = `--alignment-${id.replace(/[^a-z0-9-]/gi, '')}`;
    const current = options.find(([value]) => value === alignment) ?? options[0];
    function close(returnFocus = false) {
        popup.current?.hidePopover();
        setContext(null);
        if (returnFocus) trigger.current?.focus();
    }
    useEffect(() => editor.registerUpdateListener(({ tags }) => {
        if (tags.has(EXTERNAL_RICHTEXT_TAG)) close();
    }), [editor]);
    function open() {
        if (context) { close(true); return; }
        editor.update(() => {
            const saved = $getSelection() ?? selection.current;
            if (!$isRangeSelection(saved)) return;
            $setSelection(saved.clone());
            setContext({ selection: saved.clone(), alignment: $readToolbarState().alignment });
        }, { discrete: true });
    }
    function apply(value) {
        editor.update(() => {
            $setSelection(context.selection.clone());
            editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, value);
            $addUpdateTag(HISTORY_PUSH_TAG);
        }, { discrete: true });
        close();
        editor.focus();
    }
    useLayoutEffect(() => {
        if (!context) return undefined;
        const element = popup.current;
        element.showPopover();
        const anchored = globalThis.CSS?.supports('top: anchor(bottom)') ?? false;
        function position() {
            const button = trigger.current.getBoundingClientRect();
            const box = element.getBoundingClientRect();
            element.style.setProperty('--richtext-popup-width', `${box.width}px`);
            element.style.setProperty('--richtext-popup-height', `${box.height}px`);
            if (!anchored) {
                element.style.left = `${Math.max(8, Math.min(button.left, window.innerWidth - box.width - 8))}px`;
                element.style.top = `${Math.max(8, Math.min(button.bottom + 8, window.innerHeight - box.height - 8))}px`;
            }
        }
        position();
        const observer = new ResizeObserver(position);
        observer.observe(element);
        window.addEventListener('resize', position);
        if (!anchored) document.addEventListener('scroll', position, true);
        element.querySelector('[aria-checked="true"]')?.focus({ preventScroll: true });
        return () => {
            observer.disconnect();
            window.removeEventListener('resize', position);
            if (!anchored) document.removeEventListener('scroll', position, true);
        };
    }, [context]);
    return <>
        <ToolbarButton ref={trigger} label={`Выравнивание: ${current[1].toLowerCase()}`} icon={current[2]} disabled={disabled}
            style={{ anchorName: anchor }} aria-haspopup="menu" aria-expanded={Boolean(context)} aria-controls={context ? id : undefined} onClick={open} />
        {context && <div ref={popup} id={id} popover="auto" role="menu" aria-label="Выравнивание текста"
            className={styles.tablePopup} style={{ positionAnchor: anchor }}
            onToggle={(event) => { if (event.newState === 'closed') setContext(null); }}
            onBlur={(event) => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) close(); }}
            onKeyDown={(event) => {
                if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); }
                if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
                    event.preventDefault(); event.stopPropagation();
                    const buttons = [...event.currentTarget.querySelectorAll('button')];
                    const index = buttons.indexOf(document.activeElement);
                    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
                        : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
                    buttons[next]?.focus();
                }
            }}>
            {options.map(([value, label, icon]) => <Button key={value} variant="compact" className={styles.tableMenuItem}
                role="menuitemradio" aria-checked={context.alignment === value} onClick={() => apply(value)}>
                <Icon name={icon} size={16} /><span className={styles.alignmentLabel}>{label}</span>
                <span aria-hidden="true">{context.alignment === value ? '✓' : ''}</span>
            </Button>)}
        </div>}
    </>;
}
