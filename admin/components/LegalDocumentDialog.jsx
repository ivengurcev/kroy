import { useEffect, useId, useState } from 'react';
import { firstDocumentBlock } from '../../shared/legalDocuments.mjs';
import { isLexicalDocument } from '../../shared/richText.mjs';
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

function DocumentForm({ page, onCancel, onSaved, onUnavailable, onDirtyChange }) {
    const formId = useId();
    const [initialContent] = useState(() => page ? firstDocumentBlock(page.content).props.content : toLexicalDocument());
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
        if (busy || !dirty) return;
        const form = event.currentTarget;
        setBusy(true);
        setError('');
        try {
            const response = await apiRequest(page ? `/api/pages/${page.id}` : '/api/pages', {
                method: page ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title, path: slug, content,
                    ...(!page ? { isLegalDocument: true } : {}),
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

    return <Modal title={page ? 'Редактировать документ' : 'Добавить документ'}
        busy={busy} onClose={close} actions={<>
            <Button disabled={busy} onClick={close}>Отмена</Button>
            <Button type="submit" form={formId} variant="primary" disabled={busy || !dirty}>
                {busy ? 'Сохранение…' : page ? 'Сохранить' : 'Создать'}
            </Button>
        </>}>
        <ValidatedForm id={formId} className={styles.documentForm} inert={busy || undefined} onSubmit={submit}>
            <div className={styles.documentFields}>
                <FormField label="Название документа">
                    <Input name="title" required value={title} onInput={(event) => setTitle(event.currentTarget.value)} />
                </FormField>
                <FormField label="URL страницы">
                    <Input name="path" required disabled={page?.path === '/'} autoComplete="off" value={slug}
                        onInput={(event) => changeSlug(event.currentTarget.value)} />
                </FormField>
            </div>
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

    const compatible = page?.type === 'standard' && page.isLegalDocument
        && isLexicalDocument(firstDocumentBlock(page.content)?.props?.content);
    if (!id || compatible) {
        return <DocumentForm page={page}
            onCancel={onCancel} onSaved={onSaved} onUnavailable={onUnavailable} onDirtyChange={onDirtyChange} />;
    }
    return <Modal title="Правовой документ" onClose={onCancel} actions={<Button onClick={onCancel}>Закрыть</Button>}>
        {error ? <FormError>{error}</FormError> : page ? <p>
            Откройте <a href={page.path === '/' ? '/admin' : `/admin/pages/${page.id}`}>редактор страницы</a>,
            включите «Правовой документ» и сохраните изменения. Содержимое страницы останется на месте.
        </p> : <p role="status">Загрузка документа…</p>}
    </Modal>;
}
