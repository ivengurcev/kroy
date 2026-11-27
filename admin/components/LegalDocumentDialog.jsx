import { useEffect, useId, useState } from 'react';
import { isLegalDocumentContent } from '../../shared/legalDocuments.mjs';
import { apiRequest } from '../editor/apiRequest.mjs';
import useAutoSlug from '../editor/useAutoSlug.jsx';
import Button from '../ui/Button.jsx';
import FormError from '../ui/FormError.jsx';
import FormField from '../ui/FormField.jsx';
import Modal from '../ui/Modal.jsx';
import { Input } from '../ui/NativeControls.jsx';
import RichTextEditor from '../ui/RichTextEditor.jsx';
import { toLexicalDocument } from '../ui/richTextState.mjs';
import ValidatedForm from '../ui/ValidatedForm.jsx';
import { formResponseError } from '../ui/formValidation.mjs';
import styles from './FooterSettings.module.css';

function DocumentForm({ page, convert, onCancel, onSaved, onUnavailable, onDirtyChange }) {
    const formId = useId();
    const [initialContent] = useState(() => page ? page.content[0].props.content : toLexicalDocument());
    const [title, setTitle] = useState(page?.title ?? '');
    const [path, setPath] = useState(page?.path ?? '');
    const [content, setContent] = useState(initialContent);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const { slug, changeSlug } = useAutoSlug({ title, value: path, onChange: setPath, prefix: '/', maxLength: Infinity, enabled: !page });
    const dirty = title !== (page?.title ?? '') || slug !== (page?.path ?? '')
        || JSON.stringify(content) !== JSON.stringify(initialContent);

    useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);
    useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

    function close() {
        if (!busy && (!dirty || window.confirm('Есть несохранённые изменения. Закрыть без сохранения?'))) onCancel();
    }

    async function submit(event) {
        event.preventDefault();
        if (busy || (!dirty && !convert)) return;
        const form = event.currentTarget;
        setBusy(true);
        setError('');
        try {
            const response = await apiRequest(page ? `/api/pages/${page.id}` : '/api/pages', {
                method: page ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title, path: slug, content,
                    ...(!page || convert ? { isLegalDocument: true } : {}),
                    ...(page ? { expectedLegalVersion: page.legalVersion } : {}),
                }),
            });
            if (response.ok) {
                onSaved(await response.json());
                return;
            }
            if (response.status === 404) onUnavailable();
            const result = await response.clone().json().catch(() => ({}));
            setError(await formResponseError(response, form, result.code === 'legal_document_conflict'
                ? 'Документ изменился. Скопируйте свои правки, затем заново откройте документ.'
                : response.status === 404 ? 'Страница больше недоступна.' : 'Не удалось сохранить документ. Проверьте поля и повторите попытку.'));
            requestAnimationFrame(() => form.querySelector('[aria-invalid="true"]')?.focus());
        } catch {
            setError('Не удалось подтвердить сохранение. Введённый текст остался в форме.');
        } finally {
            setBusy(false);
        }
    }

    return <Modal title={convert ? 'Преобразовать прежнюю страницу' : page ? 'Редактировать документ' : 'Добавить документ'}
        busy={busy} onClose={close} actions={<>
            <Button disabled={busy} onClick={close}>Отмена</Button>
            <Button type="submit" form={formId} variant="primary" disabled={busy || (!dirty && !convert)}>
                {busy ? 'Сохранение…' : page ? 'Сохранить' : 'Создать'}
            </Button>
        </>}>
        <ValidatedForm id={formId} className={styles.documentForm} inert={busy || undefined} onSubmit={submit}>
            {convert && <p>Страница будет добавлена в автоматический список документов с тем же адресом и настройками.</p>}
            <FormField label="Название документа"><Input name="title" required value={title} onChange={(event) => setTitle(event.target.value)} /></FormField>
            <FormField label="URL страницы"><Input name="path" required disabled={page?.path === '/'} value={slug}
                onChange={(event) => changeSlug(event.target.value)} /></FormField>
            <RichTextEditor name="content" label="Содержимое" value={content} onChange={setContent} variant="full" minHeight="240px" />
            {error && <FormError>{error}</FormError>}
        </ValidatedForm>
    </Modal>;
}

export default function LegalDocumentDialog({ id, onCancel, onSaved, onUnavailable, onDirtyChange }) {
    const [page, setPage] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!id) return;
        const controller = new AbortController();
        fetch(`/api/pages/${id}`, { cache: 'no-store', signal: controller.signal })
            .then((response) => {
                if (response.status === 404) onUnavailable();
                if (!response.ok) throw new Error();
                return response.json();
            })
            .then(setPage)
            .catch(() => { if (!controller.signal.aborted) setError('Не удалось загрузить страницу.'); });
        return () => controller.abort();
    }, [id, onUnavailable]);

    const compatible = page?.type === 'standard' && isLegalDocumentContent(page.content);
    if (!id || compatible) {
        return <DocumentForm page={page} convert={Boolean(page && !page.isLegalDocument)}
            onCancel={onCancel} onSaved={onSaved} onUnavailable={onUnavailable} onDirtyChange={onDirtyChange} />;
    }
    return <Modal title="Правовой документ" onClose={onCancel} actions={<Button onClick={onCancel}>Закрыть</Button>}>
        {error ? <FormError>{error}</FormError> : page ? <p>
            Прежняя ссылка продолжит работать. Чтобы перейти на автоматический список, перенесите текст вручную
            в единственный блок «Правовой документ» в <a href={page.path === '/' ? '/admin' : `/admin/pages/${page.id}`}>редакторе страницы</a>,
            сохраните её и вновь выберите «Преобразовать» в настройках футера.
        </p> : <p role="status">Загрузка документа…</p>}
    </Modal>;
}
