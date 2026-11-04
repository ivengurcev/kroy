import { useCallback, useEffect, useMemo, useState } from 'react';
import Button from '../ui/Button.jsx';
import AdminPanel from '../ui/AdminPanel.jsx';
import Icon from '../ui/Icon.jsx';
import ImageField from '../editor/ImageField.jsx';
import SiteSettingsLayout from '../components/SiteSettingsLayout.jsx';
import compactStyles from '../ui/CompactForm.module.css';
import StatusBadge from '../ui/StatusBadge.jsx';
import styles from './SiteReviewsPage.module.css';

const FILTERS = [
    { value: 'all', label: 'Все' },
    { value: 'pending', label: 'Ожидают' },
    { value: 'published', label: 'Опубликованы' },
    { value: 'rejected', label: 'Отклонены' },
];
const STATUS_LABELS = { pending: 'Ожидает', published: 'Опубликован', rejected: 'Отклонён' };

function today() {
    const date = new Date();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
}

function emptyReview() {
    return { authorName: '', authorSubtitle: '', text: '', mediaId: null, reviewDate: today(), status: 'published' };
}

function formatDate(value) {
    if (typeof value !== 'string') return '—';
    const [year, month, day] = value.split('-');
    return year && month && day ? `${day}.${month}.${year}` : value;
}

function mediaIdFromUrl(value) {
    const match = typeof value === 'string' ? value.match(/\/api\/media\/([^/?#]+)/) : null;
    return match?.[1] || null;
}

async function responseError(response, fallback) {
    const result = await response.json().catch(() => ({}));
    return result.error || `${fallback}: ${response.status}`;
}

function ReviewForm({ review, editing, busy, error, onChange, onSubmit, onCancel }) {
    const imageUrl = review.mediaId ? `/api/media/${review.mediaId}` : '';
    const setField = (name) => (event) => onChange({ ...review, [name]: event.target.value });

    return (
        <AdminPanel as="form" className={styles.form} onSubmit={onSubmit}>
            <div className={styles.formHeading}>
                <h2>{editing ? 'Редактирование отзыва' : 'Новый отзыв'}</h2>
                <p>{editing ? 'Изменения сохраняются сразу в текущем сайте.' : 'Новый отзыв будет опубликован сразу.'}</p>
            </div>
            <label className={`${compactStyles.field} ${compactStyles.compact}`}>
                <span>Имя автора</span>
                <input value={review.authorName} onChange={setField('authorName')} required maxLength="200" autoFocus={!editing} />
            </label>
            <label className={`${compactStyles.field} ${compactStyles.compact}`}>
                <span>Подпись</span>
                <input value={review.authorSubtitle ?? ''} onChange={setField('authorSubtitle')} maxLength="300" />
            </label>
            <label className={`${compactStyles.field} ${compactStyles.compact} ${styles.textField}`}>
                <span>Текст отзыва</span>
                <textarea rows="4" value={review.text} onChange={setField('text')} required maxLength="5000" />
            </label>
            <div className={`${compactStyles.field} ${compactStyles.compact} ${styles.imageField}`}>
                <span>Фотография</span>
                <div className={styles.imageControls}>
                    <ImageField
                        label=""
                        value={imageUrl}
                        aspectRatio="1:1"
                        maxWidth={800}
                        onChange={(url) => onChange({ ...review, mediaId: mediaIdFromUrl(url) })}
                    />
                    {imageUrl && <Button variant="compact" title="Удалить фотографию" onClick={() => onChange({ ...review, mediaId: null })}><Icon name="delete" /> Удалить</Button>}
                </div>
            </div>
            <label className={`${compactStyles.field} ${compactStyles.compact}`}>
                <span>Дата отзыва</span>
                <input type="date" value={review.reviewDate} onChange={setField('reviewDate')} required />
            </label>
            <label className={`${compactStyles.field} ${compactStyles.compact}`}>
                <span>Статус</span>
                <select value={review.status} onChange={setField('status')}>
                    <option value="pending">Ожидает</option>
                    <option value="published">Опубликован</option>
                    <option value="rejected">Отклонён</option>
                </select>
            </label>
            {error && <p className={styles.formError} role="alert">{error}</p>}
            <div className={styles.formActions}>
                <Button type="submit" variant="primary" disabled={busy}><Icon name="save" /> {busy ? 'Сохранение…' : 'Сохранить'}</Button>
                <Button type="button" disabled={busy} onClick={onCancel}><Icon name="close" /> Отмена</Button>
            </div>
        </AdminPanel>
    );
}

export default function SiteReviewsPage() {
    const [filter, setFilter] = useState('all');
    const [reviews, setReviews] = useState([]);
    const [status, setStatus] = useState('loading');
    const [error, setError] = useState('');
    const [form, setForm] = useState(null);
    const [formError, setFormError] = useState('');
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const [reload, setReload] = useState(0);
    const hasForm = Boolean(form);
    const openCreate = useCallback(() => {
        setForm(emptyReview());
        setFormError('');
    }, []);
    const actions = useMemo(() => <Button variant="primary" aria-label="Добавить отзыв" onClick={openCreate} disabled={hasForm}><Icon name="add" /> <span>Добавить отзыв</span></Button>, [hasForm, openCreate]);

    useEffect(() => {
        const controller = new AbortController();
        const query = filter === 'all' ? '' : `?status=${encodeURIComponent(filter)}`;
        setStatus('loading');
        setError('');
        fetch(`/api/site/reviews${query}`, { signal: controller.signal })
            .then(async (response) => {
                if (!response.ok) throw new Error(await responseError(response, 'Не удалось загрузить отзывы'));
                return response.json();
            })
            .then((result) => { setReviews(result); setStatus('success'); })
            .catch((loadError) => {
                if (loadError.name !== 'AbortError') { setError(loadError.message); setStatus('error'); }
            });
        return () => controller.abort();
    }, [filter, reload]);

    function openEdit(review) {
        setForm({ authorName: review.authorName ?? '', authorSubtitle: review.authorSubtitle ?? '', text: review.text ?? '', mediaId: review.mediaId ?? null, reviewDate: review.reviewDate ?? today(), status: review.status ?? 'pending', id: review.id });
        setFormError('');
    }

    async function saveReview(event) {
        event.preventDefault();
        if (!form || saving) return;
        setSaving(true);
        setFormError('');
        const { id, ...body } = form;
        try {
            const response = await fetch(id ? `/api/site/reviews/${id}` : '/api/site/reviews', {
                method: id ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!response.ok) throw new Error(await responseError(response, 'Не удалось сохранить отзыв'));
            await response.json();
            setForm(null);
            setReload((value) => value + 1);
        } catch (saveError) {
            setFormError(saveError.message);
        } finally {
            setSaving(false);
        }
    }

    async function deleteReview(review) {
        if (deletingId || !window.confirm(`Удалить отзыв автора «${review.authorName}»?`)) return;
        setDeletingId(review.id);
        setError('');
        try {
            const response = await fetch(`/api/site/reviews/${review.id}`, { method: 'DELETE' });
            if (!response.ok) throw new Error(await responseError(response, 'Не удалось удалить отзыв'));
            setReviews((current) => current.filter(({ id }) => id !== review.id));
        } catch (deleteError) {
            setError(deleteError.message);
        } finally {
            setDeletingId(null);
        }
    }

    return (
        <SiteSettingsLayout
            section="reviews"
            title="Отзывы"
            actions={actions}
            isDirty={Boolean(form)}
            status={status}
            errorMessage={error || 'Не удалось загрузить отзывы.'}
        >
            <div className={styles.content}>
                <p>Управление отзывами текущего сайта.</p>
                <AdminPanel className={styles.filterBar}>
                    <label className={`${compactStyles.field} ${compactStyles.compact}`}>
                        <span>Показать</span>
                        <select value={filter} onChange={(event) => setFilter(event.target.value)}>
                            {FILTERS.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
                        </select>
                    </label>
                </AdminPanel>
                {form && <ReviewForm review={form} editing={Boolean(form.id)} busy={saving} error={formError} onChange={setForm} onSubmit={saveReview} onCancel={() => setForm(null)} />}
                {error && status === 'success' && <p className={styles.actionError} role="alert">{error}</p>}
                <AdminPanel className={styles.tableCard} noPadding>
                    <div className={styles.tableScroll}>
                        <table className={styles.table}>
                            <thead><tr><th>Дата</th><th>Автор</th><th>Текст</th><th>Статус</th><th><span className={styles.visuallyHidden}>Действия</span></th></tr></thead>
                            <tbody>
                                {reviews.map((review) => <tr key={review.id}>
                                    <td>{formatDate(review.reviewDate)}</td>
                                    <td><strong>{review.authorName}</strong>{review.authorSubtitle && <small>{review.authorSubtitle}</small>}</td>
                                    <td className={styles.reviewText} title={review.text}>{review.text}</td>
                                    <td><StatusBadge tone={review.status === 'rejected' ? 'error' : review.status === 'pending' ? 'warning' : 'success'}>{STATUS_LABELS[review.status] || review.status}</StatusBadge></td>
                                    <td className={styles.actions}><Button variant="compact" title="Редактировать отзыв" onClick={() => openEdit(review)} disabled={Boolean(deletingId)}><Icon name="edit" /></Button><Button variant="compact" title="Удалить отзыв" onClick={() => deleteReview(review)} disabled={Boolean(deletingId)}><Icon name="delete" /></Button></td>
                                </tr>)}
                            {!reviews.length && <tr><td className={styles.empty} colSpan="5">Отзывов пока нет.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </AdminPanel>
            </div>
        </SiteSettingsLayout>
    );
}
