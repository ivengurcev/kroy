import { useEffect, useMemo, useState } from 'react';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import Icon from '../components/ui/Icon.jsx';
import SiteSettingsLayout from '../components/admin/SiteSettingsLayout.jsx';
import compactStyles from '../components/ui/CompactForm.module.css';
import styles from './SiteArticlesPage.module.css';

const FILTERS = [
    { value: 'all', label: 'Все' },
    { value: 'draft', label: 'Черновики' },
    { value: 'published', label: 'Опубликованные' },
];
const STATUS_LABELS = { draft: 'Черновик', published: 'Опубликована' };

async function responseError(response, fallback) {
    const result = await response.json().catch(() => ({}));
    return result.error || `${fallback}: ${response.status}`;
}

function formatDate(value) {
    if (typeof value !== 'string') return '—';
    const date = new Date(value);
    return Number.isNaN(date.valueOf()) ? '—' : new Intl.DateTimeFormat('ru-RU', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(date);
}

export default function SiteArticlesPage() {
    const [filter, setFilter] = useState('all');
    const [articles, setArticles] = useState([]);
    const [status, setStatus] = useState('loading');
    const [error, setError] = useState('');
    const [deletingId, setDeletingId] = useState(null);

    useEffect(() => {
        const controller = new AbortController();
        setStatus('loading');
        setError('');
        fetch('/api/site/articles', { signal: controller.signal })
            .then(async (response) => {
                if (!response.ok) throw new Error(await responseError(response, 'Не удалось загрузить статьи'));
                return response.json();
            })
            .then((result) => {
                setArticles(Array.isArray(result) ? result : []);
                setStatus('success');
            })
            .catch((loadError) => {
                if (loadError.name !== 'AbortError') {
                    setError(loadError.message);
                    setStatus('error');
                }
            });
        return () => controller.abort();
    }, []);

    const visibleArticles = useMemo(
        () => filter === 'all' ? articles : articles.filter((article) => article.status === filter),
        [articles, filter],
    );

    function changeSection(nextSection) {
        if (nextSection === 'catalog') window.location.assign('/admin/site/catalog');
        else if (nextSection === 'reviews') window.location.assign('/admin/site/reviews');
        else if (nextSection === 'articles') return;
        else window.location.assign(`/admin/site?section=${encodeURIComponent(nextSection)}`);
    }

    async function deleteArticle(article) {
        if (deletingId || !window.confirm(`Удалить статью «${article.title}»?`)) return;
        setDeletingId(article.id);
        setError('');
        try {
            const response = await fetch(`/api/site/articles/${article.id}`, { method: 'DELETE' });
            if (!response.ok) throw new Error(await responseError(response, 'Не удалось удалить статью'));
            setArticles((current) => current.filter(({ id }) => id !== article.id));
        } catch (deleteError) {
            setError(deleteError.message);
        } finally {
            setDeletingId(null);
        }
    }

    return (
        <SiteSettingsLayout
            section="articles"
            title="Статьи"
            status={status}
            errorMessage={error || 'Не удалось загрузить статьи.'}
            onSectionChange={changeSection}
        >
            <div className={styles.content}>
                <div className={styles.toolbar}>
                    <div>
                        <h2>Статьи</h2>
                        <p>Публикуйте материалы для текущего сайта.</p>
                    </div>
                    <Button variant="primary" onClick={() => window.location.assign('/admin/site/articles/new')}>
                        <Icon name="add" /> Новая статья
                    </Button>
                </div>
                <Card className={styles.filterBar}>
                    <label className={`${compactStyles.field} ${compactStyles.compact}`}>
                        <span>Показать</span>
                        <select value={filter} onChange={(event) => setFilter(event.target.value)}>
                            {FILTERS.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
                        </select>
                    </label>
                </Card>
                {error && status === 'success' && <p className={styles.actionError} role="alert">{error}</p>}
                <Card className={styles.tableCard}>
                    <div className={styles.tableScroll}>
                        <table className={styles.table}>
                            <thead>
                                <tr><th>Название</th><th>Изменено</th><th>Статус</th><th><span className={styles.visuallyHidden}>Действия</span></th></tr>
                            </thead>
                            <tbody>
                                {visibleArticles.map((article) => <tr key={article.id}>
                                    <td><strong>{article.title}</strong><small>/{article.slug}</small></td>
                                    <td>{formatDate(article.updatedAt)}</td>
                                    <td><span className={`${styles.status} ${styles[`status${article.status}`]}`}>{STATUS_LABELS[article.status] || article.status}</span></td>
                                    <td className={styles.actions}>
                                        <Button variant="compact" title="Редактировать статью" onClick={() => window.location.assign(`/admin/site/articles/${article.id}`)} disabled={Boolean(deletingId)}><Icon name="edit" /></Button>
                                        <Button variant="compact" title="Удалить статью" onClick={() => deleteArticle(article)} disabled={Boolean(deletingId)}><Icon name="delete" /></Button>
                                    </td>
                                </tr>)}
                                {!visibleArticles.length && <tr><td className={styles.empty} colSpan="4">{articles.length ? 'Статей в этом фильтре нет.' : 'Статей пока нет.'}</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
        </SiteSettingsLayout>
    );
}
