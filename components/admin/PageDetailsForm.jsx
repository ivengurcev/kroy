import { useEffect, useRef, useState } from 'react';
import Button from '../ui/Button.jsx';
import Icon from '../ui/Icon.jsx';
import styles from './PageDetailsForm.module.css';

function joinClasses(...classes) {
    return classes.filter(Boolean).join(' ');
}

function errorMessage(status) {
    if (status === 400) return 'Проверьте название и путь страницы.';
    if (status === 409) return 'Страница с таким путём уже существует.';
    return 'Не удалось изменить страницу.';
}

export default function PageDetailsForm({
    page,
    onSaved,
    onCancel,
    onDirtyChange,
    onErrorChange,
    onSubmittingChange,
    showError = true,
    cancelFirst = false,
    handleEscape = true,
    className = '',
    pathClassName = '',
    titleClassName = '',
    actionsClassName = '',
}) {
    const [title, setTitle] = useState(page.title);
    const [path, setPath] = useState(page.path);
    const [status, setStatus] = useState('idle');
    const [error, setError] = useState('');
    const pathInputRef = useRef(null);
    const titleInputRef = useRef(null);
    const isMainPage = page.path === '/';
    const isDirty = title !== page.title || path !== page.path;
    const isSubmitting = status === 'submitting';
    const saveButton = (
        <Button type="submit" variant="primary" title="Сохранить изменения страницы" disabled={!isDirty || isSubmitting}>
            <Icon name="save" /> {isSubmitting ? 'Сохранение…' : 'Сохранить'}
        </Button>
    );
    const cancelButton = (
        <Button title="Отменить изменение страницы" disabled={isSubmitting} onClick={cancel}>
            <Icon name="close" /> Отмена
        </Button>
    );

    useEffect(() => {
        setTitle(page.title);
        setPath(page.path);
        setStatus('idle');
        setError('');
    }, [page.id, page.title, page.path]);

    useEffect(() => {
        onDirtyChange?.(isDirty);
    }, [isDirty, onDirtyChange]);

    useEffect(() => {
        onSubmittingChange?.(isSubmitting);
    }, [isSubmitting, onSubmittingChange]);

    useEffect(() => {
        const frame = requestAnimationFrame(() => {
            (isMainPage ? titleInputRef : pathInputRef).current?.focus();
        });

        return () => cancelAnimationFrame(frame);
    }, [isMainPage, page.id]);

    function setFormError(message) {
        setError(message);
        onErrorChange?.(message);
    }

    function cancel() {
        if (isSubmitting) return;
        onCancel();
    }

    function handleKeyDown(event) {
        if (!handleEscape || event.key !== 'Escape') return;

        event.preventDefault();
        event.stopPropagation();
        cancel();
    }

    async function submit(event) {
        event.preventDefault();

        if (!isDirty || isSubmitting) return;

        setStatus('submitting');
        setFormError('');

        try {
            const response = await fetch(`/api/pages/${page.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(isMainPage ? { title } : { title, path }),
            });

            if (!response.ok) {
                setStatus('idle');
                setFormError(errorMessage(response.status));
                return;
            }

            onSaved(await response.json());
        } catch {
            setStatus('idle');
            setFormError(errorMessage());
        }
    }

    return (
        <form className={joinClasses(styles.form, className)} onSubmit={submit} onKeyDown={handleEscape ? handleKeyDown : undefined}>
            <label className={joinClasses(styles.field, pathClassName)}>
                <span>Путь</span>
                <input
                    ref={pathInputRef}
                    value={path}
                    disabled={isMainPage || isSubmitting}
                    onChange={(event) => setPath(event.target.value)}
                />
            </label>
            <label className={joinClasses(styles.field, titleClassName)}>
                <span>Название</span>
                <input
                    ref={titleInputRef}
                    value={title}
                    disabled={isSubmitting}
                    onChange={(event) => setTitle(event.target.value)}
                />
            </label>
            <div className={joinClasses(styles.actions, actionsClassName)}>
                {cancelFirst ? <>{cancelButton}{saveButton}</> : <>{saveButton}{cancelButton}</>}
            </div>
            {showError && error && (
                <div className={styles.error} role="alert">{error}</div>
            )}
        </form>
    );
}
