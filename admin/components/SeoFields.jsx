import ImageField from '../editor/ImageField.jsx';
import Button from '../ui/Button.jsx';
import { DEFAULT_TITLE_TEMPLATE, resolvePageMeta, isSeoDomain } from '../../shared/seo.mjs';
import styles from './SeoFields.module.css';

export default function SeoFields({ value, onChange, siteData, page }) {
    const isSite = !page;
    const update = (key, next) => {
        const result = { ...value };
        if (next === '' || next === null || next === 'inherit') delete result[key];
        else result[key] = next;
        onChange(result);
    };
    const inherited = page ? resolvePageMeta({ ...siteData?.site, seo: siteData?.seo }, { ...page, seo: {} }) : null;
    const inheritedImage = siteData?.seo?.imageId;
    const fieldName = (key) => isSite ? key : `seo.${key}`;
    return <div className={styles.fields}>
        {isSite && <>
            <label className={styles.field}><span>Название сайта для SEO</span><input name="name" maxLength={300} value={value.name ?? ''} placeholder={siteData?.site?.name} onChange={(event) => update('name', event.target.value)} /></label>
            <label className={styles.field}><span>Шаблон заголовка страниц</span><input name="titleTemplate" maxLength={500} value={value.titleTemplate ?? ''} placeholder={DEFAULT_TITLE_TEMPLATE} onChange={(event) => update('titleTemplate', event.target.value)} /><small>Переменные: {'{page}'} — название страницы, {'{site}'} — название сайта.</small></label>
        </>}
        {!isSite && <label className={styles.field}><span>SEO title</span><input name={fieldName('title')} maxLength={300} value={value.title ?? ''} placeholder={inherited?.title} onChange={(event) => update('title', event.target.value)} /></label>}
        <label className={styles.field}><span>{isSite ? 'Описание сайта' : 'Meta description'}</span><textarea name={fieldName('description')} rows={4} maxLength={2000} value={value.description ?? ''} placeholder={inherited?.description || 'Не задано'} onChange={(event) => update('description', event.target.value)} /></label>
        <ImageField name={fieldName('imageId')} label={isSite ? 'Основное OG-изображение' : 'OG-изображение страницы'} value={value.imageId ? `/api/media/${value.imageId}` : ''} onChange={(url) => update('imageId', url.split('/').pop())} />
        {value.imageId && <Button onClick={() => update('imageId', null)}>Убрать изображение</Button>}
        {!isSite && <small>{inheritedImage ? <>По умолчанию — изображение сайта.<img className={styles.inheritedImage} src={`/api/media/${inheritedImage}`} alt="OG-изображение сайта" /></> : 'Изображение сайта не задано.'}</small>}
        {isSite ? <>
            <label className={styles.field}><span>Основной домен</span><select name="primaryDomain" value={value.primaryDomain ?? ''} onChange={(event) => update('primaryDomain', event.target.value)}><option value="">Автоматически: первый публичный домен</option>{siteData?.domains?.filter(isSeoDomain).map((domain) => <option key={domain} value={domain}>{domain}</option>)}</select><small>Canonical и OG используют HTTPS на этом домене. DNS и TLS настраиваются отдельно.</small></label>
            <label className={styles.checkbox}><input name="indexable" type="checkbox" checked={value.indexable !== false} onChange={(event) => update('indexable', event.target.checked)} />Разрешить индексацию</label>
        </> : <label className={styles.field}><span>Индексация</span><select name={fieldName('indexing')} value={value.indexing ?? 'inherit'} onChange={(event) => update('indexing', event.target.value)}><option value="inherit">Наследовать ({siteData?.seo?.indexable === false ? 'запрещена' : 'разрешена'})</option><option value="allow">Разрешить</option><option value="deny">Запретить</option></select><small>Запрет индексации всего сайта имеет приоритет.</small></label>}
        {!isSite && <small>Пустые поля наследуют настройки сайта при каждой публикации.</small>}
        {isSite && <small>Изменения вступят в силу после публикации. При запрете индексации страницы получают noindex; обход остаётся доступным, чтобы поисковик прочитал эту директиву.</small>}
    </div>;
}
