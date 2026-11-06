import { useEffect, useRef, useState } from 'react';
import Button from '../ui/Button.jsx';
import Table from '../ui/Table.jsx';
import { AdminListToolbar, AdminListField, Pagination } from './AdminList.jsx';
import listStyles from './AdminList.module.css';
import Icon from '../ui/Icon.jsx';
import StatusBadge from '../ui/StatusBadge.jsx';
import ImageField from '../editor/ImageField.jsx';
import fieldStyles from '../editor/Field.module.css';
import styles from './CatalogEditor.module.css';
import ValidatedForm from '../ui/ValidatedForm.jsx';
import { apiRequest } from '../editor/apiRequest.mjs';

const UNCATEGORIZED = '__uncategorized__';

function emptyProduct(categoryId, sortOrder) { return { categoryId, name: '', description: '', mediaId: null, price: '0.00', type: 'service', sortOrder, status: 'published' }; }
function emptyCategory(sortOrder) { return { name: '', sortOrder }; }

export default function CatalogEditor() {
    const [activeCategoryId, setActiveCategoryId] = useState(null);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [dialog, setDialog] = useState(null);
    const [dialogDraft, setDialogDraft] = useState(null);
    const [dialogError, setDialogError] = useState('');
    const [categories, setCategories] = useState([]);
    const [uncategorizedCount, setUncategorizedCount] = useState(0);
    const [products, setProducts] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const [listStatus, setListStatus] = useState('loading');
    const [listError, setListError] = useState('');
    const [saving, setSaving] = useState(false);
    const [listRevision, setListRevision] = useState(0);
    const dialogRef = useRef(null);

    useEffect(() => {
        const element = dialogRef.current;
        if (!element) return;
        if (dialog && !element.open) element.showModal();
        else if (!dialog && element.open) element.close();
    }, [dialog]);

    useEffect(() => {
        const controller = new AbortController();
        fetch('/api/site/catalog/categories', { signal: controller.signal }).then(async (response) => {
            if (!response.ok) throw new Error('Не удалось загрузить разделы каталога.');
            return response.json();
        }).then((result) => {
            setCategories(result.categories || []);
            setUncategorizedCount(result.uncategorizedCount || 0);
            setActiveCategoryId((current) => current ?? result.categories?.[0]?.id ?? UNCATEGORIZED);
        }).catch((cause) => { if (cause.name !== 'AbortError') { setListError(cause.message); setListStatus('error'); } });
        return () => controller.abort();
    }, []);

    const selectedCategoryId = activeCategoryId === UNCATEGORIZED || categories.some(({ id: categoryId }) => categoryId === activeCategoryId)
        ? activeCategoryId
        : categories[0]?.id ?? UNCATEGORIZED;
    const selectedCategory = categories.find(({ id: categoryId }) => categoryId === selectedCategoryId);
    const uncategorized = selectedCategoryId === UNCATEGORIZED;
    const dialogDirty = Boolean(dialog && dialogDraft && JSON.stringify(dialogDraft) !== JSON.stringify(dialog.initial));
    const offset = page * 50;

    useEffect(() => {
        if (!categories.length && activeCategoryId === null) return;
        const controller = new AbortController();
        const query = new URLSearchParams({ categoryId: uncategorized ? 'null' : selectedCategoryId, search, type: typeFilter, status: filter, limit: '50', offset: String(offset) });
        setListStatus('loading'); setListError('');
        fetch(`/api/site/catalog/products?${query}`, { signal: controller.signal }).then(async (response) => {
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Не удалось загрузить товары.');
            return result;
        }).then((result) => { setProducts(result.products); setTotal(result.total); setListStatus('success'); })
            .catch((cause) => { if (cause.name !== 'AbortError') { setListError(cause.message); setListStatus('error'); } });
        return () => controller.abort();
    }, [categories.length, selectedCategoryId, uncategorized, search, typeFilter, filter, offset, listRevision]);

    function changeQuery(change) { setPage(0); change(); }
    function selectCategory(categoryId) { setPage(0); setActiveCategoryId(categoryId); }

    function openCategory(category = null) {
        const draft = category ? { ...category } : emptyCategory(categories.length);
        setDialogDraft(draft);
        setDialogError('');
        setDialog({ type: 'category', mode: category ? 'edit' : 'create', id: category?.id ?? null, initial: { ...draft } });
    }

    function openProduct(product = null) {
        const nextCategoryId = uncategorized ? null : selectedCategoryId;
        const draft = product ? { ...product } : emptyProduct(nextCategoryId, offset + products.length);
        setDialogDraft(draft);
        setDialogError('');
        setDialog({ type: 'product', mode: product ? 'edit' : 'create', id: product?.id ?? null, initial: { ...draft } });
    }

    function closeDialog(force = false) {
        if (saving && !force) return;
        if (!force && dialogDirty && !window.confirm('Отменить изменения? Несохранённые данные формы будут потеряны.')) return;
        setDialog(null);
        setDialogDraft(null);
        setDialogError('');
    }

    function handleDialogCancel(event) {
        event.preventDefault();
        closeDialog();
    }

    async function saveDialog(event) {
        event.preventDefault();
        if (!dialog || !dialogDraft || saving) return;
        const name = dialogDraft.name.trim();
        if (!name) {
            setDialogError(dialog.type === 'category' ? 'Укажите название раздела.' : 'Укажите название товара.');
            return;
        }

        setSaving(true); setDialogError('');
        try {
            if (dialog.type === 'category') {
                const body = { name, sortOrder: dialogDraft.sortOrder };
                const response = await apiRequest(dialog.mode === 'create' ? '/api/site/catalog/categories' : `/api/site/catalog/categories/${dialog.id}`, {
                    method: dialog.mode === 'create' ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
                });
                const result = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(result.error || 'Не удалось сохранить раздел.');
                setCategories((current) => dialog.mode === 'create' ? [...current, result] : current.map((item) => item.id === result.id ? result : item));
                setActiveCategoryId(result.id);
                setPage(0);
            } else {
                const product = { ...dialogDraft, name };
                const response = await apiRequest(dialog.mode === 'create' ? '/api/site/catalog/products' : `/api/site/catalog/products/${dialog.id}`, {
                    method: dialog.mode === 'create' ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(product),
                });
                const result = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(result.error || 'Не удалось сохранить товар или услугу.');
                const listedCategoryId = uncategorized ? null : selectedCategoryId;
                const previousCategoryId = dialog.initial.categoryId ?? null;
                if ((result.categoryId ?? null) === listedCategoryId) {
                    setProducts((current) => dialog.mode === 'create' ? [...current, result].slice(-50) : current.map((item) => item.id === result.id ? result : item));
                    if (dialog.mode === 'create' || previousCategoryId !== listedCategoryId) setTotal((current) => current + 1);
                } else {
                    setProducts((current) => current.filter(({ id: itemId }) => itemId !== result.id));
                    if (dialog.mode === 'edit' && previousCategoryId === listedCategoryId) setTotal((current) => Math.max(0, current - 1));
                }
                if (dialog.mode === 'edit' && previousCategoryId !== (result.categoryId ?? null)) {
                    setCategories((current) => current.map((item) => ({ ...item, productCount: Math.max(0, (item.productCount || 0) + (item.id === dialog.initial.categoryId ? -1 : item.id === result.categoryId ? 1 : 0)) })));
                    if (previousCategoryId === null) setUncategorizedCount((count) => Math.max(0, count - 1));
                    if (result.categoryId === null) setUncategorizedCount((count) => count + 1);
                }
                if (dialog.mode === 'create') setCategories((current) => current.map((item) => ({ ...item, productCount: item.id === result.categoryId ? (item.productCount || 0) + 1 : item.productCount })));
                if (dialog.mode === 'create' && result.categoryId === null) setUncategorizedCount((count) => count + 1);
                setListRevision((current) => current + 1);
            }
            closeDialog(true);
        } catch (cause) { setDialogError(cause.message); }
        finally { setSaving(false); }
    }

    async function deleteCategory(category) {
        if (!window.confirm(`Удалить раздел «${category.name}»? Его товары перейдут в «Без раздела».`)) return;
        setListError('');
        try {
            const response = await apiRequest(`/api/site/catalog/categories/${category.id}`, { method: 'DELETE' });
            if (!response.ok) { const result = await response.json().catch(() => ({})); throw new Error(result.error || 'Не удалось удалить раздел.'); }
            setCategories((current) => current.filter(({ id: categoryId }) => categoryId !== category.id));
            setUncategorizedCount((count) => count + (category.productCount || 0));
            setProducts([]); setTotal(0);
            if (selectedCategoryId === category.id) {
                setActiveCategoryId(categories.find(({ id: categoryId }) => categoryId !== category.id)?.id ?? UNCATEGORIZED);
            }
        } catch (cause) { setListError(cause.message); }
    }

    async function deleteProduct(product) {
        if (!window.confirm(`Удалить «${product.name || 'товар'}»?`)) return;
        try {
            const response = await apiRequest(`/api/site/catalog/products/${product.id}`, { method: 'DELETE' });
            if (!response.ok) { const result = await response.json().catch(() => ({})); throw new Error(result.error || 'Не удалось удалить товар.'); }
            setProducts((current) => current.filter(({ id }) => id !== product.id));
            setTotal((current) => Math.max(0, current - 1));
            if (products.length === 1 && page > 0) setPage((current) => current - 1);
            setListRevision((current) => current + 1);
            if (uncategorized) setUncategorizedCount((count) => Math.max(0, count - 1));
            else setCategories((current) => current.map((item) => item.id === selectedCategoryId ? { ...item, productCount: Math.max(0, item.productCount - 1) } : item));
        } catch (cause) { setListError(cause.message); }
    }

    return <div className={styles.catalog}>
        <div className={styles.layout}>
            <div className={styles.categoryPanel}>
                <h2 className={styles.categoryHeading}>Разделы каталога</h2>
                <div className={styles.categoryList} role="group" aria-label="Разделы каталога">
                    {categories.map((category) => <div className={`${styles.categoryRow} ${selectedCategoryId === category.id ? styles.categoryActive : ''}`} key={category.id}>
                        <button className={styles.categorySelect} type="button" aria-current={selectedCategoryId === category.id ? 'true' : undefined} onClick={() => selectCategory(category.id)}>
                            <span title={category.name}>{category.name || 'Без названия'}</span>
                            <small>{category.productCount || 0}</small>
                        </button>
                        <div className={styles.categoryActions}>
                            <Button variant="iconCompact" title="Редактировать раздел" aria-label={`Редактировать раздел «${category.name}»`} onClick={() => openCategory(category)}><Icon name="edit" size={18} /></Button>
                            <Button variant="iconCompact" title="Удалить раздел" aria-label={`Удалить раздел «${category.name}»`} onClick={() => deleteCategory(category)}><Icon name="delete" size={18} /></Button>
                        </div>
                    </div>)}
                    <div className={`${styles.categoryRow} ${uncategorized ? styles.categoryActive : ''}`}>
                        <button className={styles.categorySelect} type="button" aria-current={uncategorized ? 'true' : undefined} onClick={() => selectCategory(UNCATEGORIZED)}>
                            <span>Без раздела</span>
                            <small>{uncategorizedCount}</small>
                        </button>
                    </div>
                </div>
                <button type="button" className={styles.addCategory} onClick={() => openCategory()}><Icon name="add" size={18} /> Добавить раздел</button>
            </div>

            <div className={styles.productPanel}>
                <div className={styles.productHeading}>
                    <div><h2>{selectedCategory?.name || 'Без раздела'}</h2><small>Товаров: {total}</small></div>
                </div>
                <AdminListToolbar actions={<Button variant="primary" size="compact" onClick={() => openProduct()}><Icon name="add" size={18} /> Добавить товар/услугу</Button>}>
                    <AdminListField label="Поиск"><input type="search" value={search} onChange={(event) => changeQuery(() => setSearch(event.target.value))} placeholder="Название или описание" /></AdminListField>
                    <AdminListField label="Статус"><select value={filter} onChange={(event) => changeQuery(() => setFilter(event.target.value))}><option value="">Все статусы</option><option value="published">Опубликованные</option><option value="hidden">Скрытые</option></select></AdminListField>
                    <AdminListField label="Тип"><select value={typeFilter} onChange={(event) => changeQuery(() => setTypeFilter(event.target.value))}><option value="">Все типы</option><option value="goods">Товары</option><option value="service">Услуги</option></select></AdminListField>
                </AdminListToolbar>
                {listError && <p className={listStyles.error} role="alert">{listError}</p>}
                {listStatus === 'loading' && <p className={listStyles.state} role="status">Загрузка товаров…</p>}
                {listStatus === 'error' && <p className={listStyles.state} role="alert">{listError || 'Не удалось загрузить товары.'}</p>}
                {listStatus === 'success' && <>
                    <Table className={styles.table} aria-label="Товары и услуги">
                        <thead><tr><th>Название</th><th>Тип</th><th>Цена</th><th>Статус</th><th><span className={styles.visuallyHidden}>Действия</span></th></tr></thead>
                        <tbody>
                            {products.map((product) => <tr key={product.id}>
                                <td>
                                    <button className={styles.productTitle} type="button" onClick={() => openProduct(product)}>{product.name || 'Без названия'}</button>
                                    <div className={styles.mobileMeta}>
                                        <span>{product.type === 'goods' ? 'Товар' : 'Услуга'}</span>
                                        <span>{product.price} ₽</span>
                                        <StatusBadge tone={product.status === 'hidden' ? 'warning' : 'success'}>{product.status === 'hidden' ? 'Скрыт' : 'Опубликован'}</StatusBadge>
                                    </div>
                                </td>
                                <td className={styles.desktopMeta}>{product.type === 'goods' ? 'Товар' : 'Услуга'}</td>
                                <td className={styles.desktopMeta}>{product.price} ₽</td>
                                <td className={styles.desktopMeta}><StatusBadge tone={product.status === 'hidden' ? 'warning' : 'success'}>{product.status === 'hidden' ? 'Скрыт' : 'Опубликован'}</StatusBadge></td>
                                <td className={styles.productActions}>
                                    <Button variant="iconCompact" title="Редактировать товар" aria-label={`Редактировать «${product.name}»`} onClick={() => openProduct(product)}><Icon name="edit" size={18} /></Button>
                                    <Button variant="iconCompact" title="Удалить товар" aria-label={`Удалить «${product.name}»`} onClick={() => deleteProduct(product)}><Icon name="delete" size={18} /></Button>
                                </td>
                            </tr>)}
                            {!products.length && <tr><td className={listStyles.state} colSpan="5">{search || filter || typeFilter ? 'По заданным условиям ничего не найдено.' : 'В этом разделе пока нет товаров.'}</td></tr>}
                        </tbody>
                    </Table>
                    <Pagination page={page} hasNext={(page + 1) * 50 < total} onChange={setPage} total={total} />
                </>}
            </div>
        </div>

        <dialog
            ref={dialogRef}
            className={`${styles.dialog} ${dialog?.type === 'product' ? styles.productDialog : ''}`}
            aria-labelledby="catalog-dialog-title"
            onCancel={handleDialogCancel}
            onClick={(event) => { if (event.target === event.currentTarget) closeDialog(); }}
        >
            {dialog && dialogDraft && <ValidatedForm className={styles.dialogForm} onSubmit={saveDialog}>
                <header className={styles.dialogHeader}>
                    <h2 id="catalog-dialog-title">{dialog.type === 'category'
                        ? dialog.mode === 'create' ? 'Новый раздел' : 'Редактировать раздел'
                        : dialog.mode === 'create' ? 'Новый товар' : 'Редактировать товар'}</h2>
                </header>

                {dialog.type === 'category' ? <div className={styles.dialogBody}>
                    <label className={fieldStyles.field}>
                        <span>Название</span>
                        <input name="name" autoFocus required maxLength="200" value={dialogDraft.name} disabled={saving} onChange={(event) => setDialogDraft((current) => ({ ...current, name: event.target.value }))} />
                    </label>
                    {dialogError && <p className={styles.dialogError} role="alert">{dialogError}</p>}
                </div> : <div className={`${styles.dialogBody} ${styles.productForm}`}>
                    <label className={`${fieldStyles.field} ${styles.fullField}`}>
                        <span>Название</span>
                        <input name="name" autoFocus required maxLength="200" value={dialogDraft.name} disabled={saving} onChange={(event) => setDialogDraft((current) => ({ ...current, name: event.target.value }))} />
                    </label>
                    <label className={fieldStyles.field}>
                        <span>Цена, ₽</span>
                        <input name="price" inputMode="decimal" pattern="[0-9]{1,10}([.,][0-9]{1,2})?" data-format-message="Укажите неотрицательную цену: до 10 цифр и двух знаков после точки" value={dialogDraft.price} onChange={(event) => setDialogDraft((current) => ({ ...current, price: event.target.value.replace(',', '.') }))} />
                    </label>
                    <label className={fieldStyles.field}>
                        <span>Тип позиции</span>
                        <select value={dialogDraft.type} onChange={(event) => setDialogDraft((current) => ({ ...current, type: event.target.value }))}>
                            <option value="service">Услуга</option><option value="goods">Товар</option>
                        </select>
                    </label>
                    <label className={fieldStyles.field}>
                        <span>Раздел</span>
                        <select value={dialogDraft.categoryId ?? ''} onChange={(event) => setDialogDraft((current) => ({ ...current, categoryId: event.target.value || null }))}>
                            <option value="">Без раздела</option>
                            {categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}
                        </select>
                    </label>
                    <label className={`${fieldStyles.field} ${styles.checkboxField}`}>
                        <input type="checkbox" checked={dialogDraft.status === 'published'} onChange={(event) => setDialogDraft((current) => ({ ...current, status: event.target.checked ? 'published' : 'hidden' }))} />
                        <span>Опубликован</span>
                    </label>
                    <label className={`${fieldStyles.field} ${styles.fullField}`}>
                        <span>Описание</span>
                        <textarea rows="5" value={dialogDraft.description} onChange={(event) => setDialogDraft((current) => ({ ...current, description: event.target.value }))} />
                    </label>
                    <div className={styles.fullField}>
                        <ImageField label="Изображение" value={dialogDraft.mediaId ? `/api/media/${dialogDraft.mediaId}` : ''} aspectRatio="4:3" maxWidth={1200} onChange={(url) => setDialogDraft((current) => ({ ...current, mediaId: url.split('/').pop() || null }))} />
                    </div>
                    {dialogError && <p className={`${styles.dialogError} ${styles.fullField}`} role="alert">{dialogError}</p>}
                </div>}

                <footer className={styles.dialogActions}>
                    <Button variant="secondary" disabled={saving} onClick={() => closeDialog()}>Отмена</Button>
                    <Button type="submit" variant="primary" disabled={saving}>{saving ? 'Сохранение…' : 'Сохранить'}</Button>
                </footer>
            </ValidatedForm>}
        </dialog>
    </div>;
}
