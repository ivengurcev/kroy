import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { fieldValidationMessage } from './formValidation.mjs';
import styles from './ValidatedForm.module.css';

export default function ValidatedForm({ children, onSubmit, onInput, ...props }) {
    const ref = useRef(null);
    const [errors, setErrors] = useState([]);
    const errorId = useId();

    function present(entries) {
        entries.sort((a, b) => a.field.compareDocumentPosition(b.field) & 2 ? 1 : -1);
        setErrors(entries.map((entry, index) => ({ ...entry, errorIndex: index, failedValue: entry.field.value ?? entry.field.textContent })));
        for (const field of ref.current?.querySelectorAll('[aria-invalid="true"]') || []) {
            field.removeAttribute('aria-invalid');
            field.removeAttribute('aria-errormessage');
        }
        entries.forEach(({ field }, index) => {
            field.setAttribute('aria-invalid', 'true');
            field.setAttribute('aria-errormessage', `${errorId}-${index}`);
        });
        entries[0]?.field.focus();
    }

    useEffect(() => {
        const form = ref.current;
        const receive = ({ detail }) => {
            const entries = Object.entries(detail).map(([name, message]) => ({
                field: form.querySelector(`[name="${CSS.escape(name)}"]`), message,
            })).filter(({ field, message }) => field && typeof message === 'string');
            present(entries);
        };
        form.addEventListener('kroy:field-errors', receive);
        return () => form.removeEventListener('kroy:field-errors', receive);
    }, []);

    useEffect(() => {
        setErrors((current) => {
            const next = current.filter(({ field, failedValue }) => {
                const keep = field.isConnected && (field.value ?? field.textContent) === failedValue;
                if (!keep) { field.removeAttribute('aria-invalid'); field.removeAttribute('aria-errormessage'); }
                return keep;
            });
            return next.length === current.length ? current : next;
        });
    }, [children]);

    function submit(event) {
        const entries = [...event.currentTarget.elements]
            .filter((field) => !field.disabled && ['INPUT', 'SELECT', 'TEXTAREA'].includes(field.tagName) && !['submit', 'button', 'file', 'checkbox', 'radio'].includes(field.type))
            .map((field) => ({ field, message: fieldValidationMessage(field) }))
            .filter(({ message }) => message);
        for (const field of event.currentTarget.querySelectorAll('[data-validation-message]')) {
            if (field.dataset.validationMessage) entries.push({ field, message: field.dataset.validationMessage });
        }
        present(entries);
        if (entries.length) { event.preventDefault(); return; }
        onSubmit?.(event);
    }

    return <form {...props} ref={ref} noValidate onSubmit={submit} onInput={(event) => {
        const field = event.target;
        setErrors((current) => current.filter((entry) => {
            const related = entry.field === field || entry.field.contains(field) || entry.field.closest('[data-validation-group]')?.contains(field);
            if (related) { entry.field.removeAttribute('aria-invalid'); entry.field.removeAttribute('aria-errormessage'); }
            return !related;
        }));
        onInput?.(event);
    }}>
        {children}
        {errors.map(({ field, message, errorIndex }) => {
            const container = field.closest('label') || field.parentElement;
            return createPortal(<small id={`${errorId}-${errorIndex}`} className={styles.error} role="alert">{message}</small>, container, `${field.name}-${errorIndex}`);
        })}
    </form>;
}
