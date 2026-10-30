import { useEffect, useMemo, useState } from 'react';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import Icon from '../components/ui/Icon.jsx';
import ImageField from '../editor/ImageField.jsx';
import SiteSettingsLayout from '../components/admin/SiteSettingsLayout.jsx';
import ArticleEditor from '../components/admin/ArticleEditor.jsx';
import compactStyles from '../components/ui/CompactForm.module.css';
import styles from './SiteArticleEditorPage.module.css';

const EMPTY_CONTENT = {
    root: {
        type: 'root',
        children: [],
        direction: null,
        format: '',
        indent: 0,
        version: 1,
    },
};

function emptyArticle() {
    return { slug: '', title: '', summary: '', content: null, coverMediaId: null, status: 'draft' };
}

function mediaIdFromUrl(value) {
    const match = typeof value === 'string' ? value.match(/\/api\/media\/([^/?#]+)/) : null;
    return match?.[1] || null;
}

function hasText(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    if (value.type === 'text' && typeof value.text === 'string' && value.text.trim()) return true;
    return Array.isArray(value.children) && value.children.some(hasText);
}

function articleHasText(content) {
    return Boolean(content?.root && hasText(content.root));
}

async function responseError(response, fallback) {
    const result = await response.json().catch(() => ({}));
    return result.error || `${fallback}: ${response.status}`;
}

export default function SiteArticleEditorPage() {
    const [articleId, setArticleId] = useState(undefined);
    const [article, setArticle] = useState(null);
    const [savedArticle, setSavedArticle] = useState(null);
    const [status, setStatus] = useState('loading');
    const [error, setError] = useState('');
    const [formError, setFormError] = useState('');
    const [saveStatus, setSaveStatus] = useState('idle');

    useEffect(() => {
        const match = window.location.pathname.match(/^\/admin\/site\/articles(?:\/([^/]+))?/);
        const nextId = match?.[1] && match[1] !== 'new' ? match[1] : null;
        setArticleId(nextId);
    }, []);

    useEffect(() => {
        if (articleId === undefined) return undefined;
        if (!articleId) {
            const next = emptyArticle();
            setArticle(next);
            setSavedArticle(next);
            setStatus('success');
            return undefined;
        }

        const controller = new AbortController();
        setStatus('loading');
        setError('');
        fetch(`/api/site/articles/${articleId}`, { signal: controller.signal })
            .then(async (response) => {
                if (!response.ok) throw new Error(await responseError(response, 'Не удалось загрузить статью'));
                return response.json();
            })
            .then((result) => {
                setArticle(result);
                setSavedArticle(result);
                setStatus('success');
            })
            .catch((loadError) => {
                if (loadError.name !== 'AbortError') {
                    setError(loadError.message);
                    setStatus('error');
                }
            });
        return () => controller.abort();
    }, [articleId]);

    const dirty = Boolean(article && savedArticle && JSON.stringify(article) !== JSON.stringify(savedArticle));

    useEffect(() => {
        if (!dirty) return undefined;
        const warn = (event) => {
            event.preventDefault();
            event.returnValue = '';
        };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [dirty]);

    function changeSection(nextSection) {
        if (nextSection === 'catalog') window.location.assign('/admin/site/catalog');
        else if (nextSection === 'reviews') window.location.assign('/admin/site/reviews');
        else if (nextSection !== 'articles') window.location.assign(`/admin/site?section=${encodeURIComponent(nextSection)}`);
    }

    function updateField(name, value) {
        setArticle((current) => ({ ...current, [name]: value }));
        setFormError('');
        setSaveStatus('idle');
    }

    async function saveArticle(event, requestedStatus = null) {
        event?.preventDefault();
        if (!article || saveStatus === 'saving') return;
        const nextStatus = requestedStatus || article.status;
        if (nextStatus === 'published' && !articleHasText(article.content)) {
            setFormError('Для публикации добавьте непустой текст статьи.');
            return;
        }

        setSaveStatus('saving');
        setFormError('');
        const body = { ...article, status: nextStatus };
        delete body.id;
        delete body.createdAt;
        delete body.updatedAt;
        delete body.publishedAt;
        try {
            const response = await fetch(articleId ? `/api/site/articles/${articleId}` : '/api/site/articles', {
                method: articleId ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!response.ok) throw new Error(await responseError(response, 'Не удалось сохранить статью'));
            const result = await response.json();
            setArticle(result);
            setSavedArticle(result);
            setSaveStatus('success');
            if (!articleId && result.id) {
                window.history.replaceState({}, '', `/admin/site/articles/${result.id}`);
                setArticleId(result.id);
            }
        } catch (saveError) {
            setFormError(saveError.message);
            setSaveStatus('idle');
        }
    }

    async function deleteCurrentArticle() {
        if (!articleId || !window.confirm(`Удалить статью «${article?.title || ''}»?`)) return;
        try {
            const response = await fetch(`/api/site/articles/${articleId}`, { method: 'DELETE' });
            if (!response.ok) throw new Error(await responseError(response, 'Не удалось удалить статью'));
            window.location.assign('/admin/site/articles');
        } catch (deleteError) {
            setFormError(deleteError.message);
        }
    }

    const imageUrl = article?.coverMediaId ? `/api/media/${article.coverMediaId}` : '';
    const editorValue = useMemo(() => article?.content || EMPTY_CONTENT, [article?.content]);
    const title = articleId ? 'Редактирование статьи' : 'Новая статья';

    return (
        <SiteSettingsLayout
            section="articles"
            title={title}
            status={status}
            errorMessage={error || 'Не удалось загрузить статью.'}
            isDirty={dirty}
            saveStatus={saveStatus}
            onSave={() => saveArticle()}
            onSectionChange={changeSection}
        >
            {article && <Card as="form" className={styles.form} onSubmit={saveArticle}>
                <div className={styles.heading}>
                    <div>
                        <h2>{title}</h2>
                        <p>{articleId ? 'Изменения сохраняются только после явного действия.' : 'Сначала сохраните черновик, чтобы открыть постоянный адрес статьи.'}</p>
                    </div>
                    <Button type="button" variant="secondary" onClick={() => window.location.assign('/admin/site/articles')}><Icon name="back" /> К списку</Button>
                </div>
                <label className={`${compactStyles.field} ${compactStyles.compact}`}>
                    <span>Заголовок</span>
                    <input value={article.title} onChange={(event) => updateField('title', event.target.value)} required maxLength="300" autoFocus />
                </label>
                <label className={`${compactStyles.field} ${compactStyles.compact}`}>
                    <span>Slug</span>
                    <input value={article.slug} onChange={(event) => updateField('slug', event.target.value)} required maxLength="200" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" />
                </label>
                <label className={`${compactStyles.field} ${compactStyles.long}`}>
                    <span>Краткое описание</span>
                    <textarea rows="3" value={article.summary ?? ''} onChange={(event) => updateField('summary', event.target.value)} maxLength="2000" />
                </label>
                <div className={`${compactStyles.field} ${compactStyles.long} ${styles.coverField}`}>
                    <span>Обложка</span>
                    <ImageField
                        label=""
                        value={imageUrl}
                        aspectRatio="16:9"
                        maxWidth={1600}
                        onChange={(url) => updateField('coverMediaId', mediaIdFromUrl(url))}
                    />
                    {imageUrl && <Button type="button" variant="compact" onClick={() => updateField('coverMediaId', null)}><Icon name="delete" /> Удалить обложку</Button>}
                </div>
                <div className={styles.editorField}>
                    <span className={styles.editorLabel}>Текст статьи</span>
                    <ArticleEditor value={editorValue} onChange={(content) => updateField('content', content)} disabled={saveStatus === 'saving'} />
                </div>
                <label className={`${compactStyles.field} ${compactStyles.compact}`}>
                    <span>Статус</span>
                    <select value={article.status} onChange={(event) => updateField('status', event.target.value)}>
                        <option value="draft">Черновик</option>
                        <option value="published">Опубликована</option>
                    </select>
                </label>
                {formError && <p className={styles.formError} role="alert">{formError}</p>}
                <div className={styles.actions}>
                    {articleId && <Button type="button" variant="danger" onClick={deleteCurrentArticle} disabled={saveStatus === 'saving'}><Icon name="delete" /> Удалить</Button>}
                    <span className={styles.actionSpacer} />
                    <Button type="submit" variant="secondary" disabled={saveStatus === 'saving'}><Icon name="save" /> {saveStatus === 'saving' ? 'Сохранение…' : 'Сохранить'}</Button>
                    <Button type="button" variant="primary" disabled={saveStatus === 'saving'} onClick={() => saveArticle(undefined, 'published')}><Icon name="publish" /> Опубликовать</Button>
                </div>
            </Card>}
        </SiteSettingsLayout>
    );
}
