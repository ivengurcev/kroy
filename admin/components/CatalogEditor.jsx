import { useEffect, useMemo, useRef, useState } from 'react';
import Button from '../ui/Button.jsx';
import Table from '../ui/Table.jsx';
import { AdminListToolbar, AdminListField, Pagination, useListPage } from './AdminList.jsx';
import listStyles from './AdminList.module.css';
import Icon from '../ui/Icon.jsx';
import StatusBadge from '../ui/StatusBadge.jsx';
import ImageField from '../editor/ImageField.jsx';
import fieldStyles from '../editor/Field.module.css';
import styles from './CatalogEditor.module.css';
import ValidatedForm from '../ui/ValidatedForm.jsx';

const UNCATEGORIZED = '__uncategorized__';

function id() { return globalThis.crypto?.randomUUID?.() ?? `local-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function emptyProduct(categoryId, sortOrder) { return { id: id(), categoryId, name: '', description: '', mediaId: null, price: '0.00', type: 'service', sortOrder, status: 'published' }; }
function emptyCategory(sortOrder) { return { id: id(), name: '', sortOrder }; }
function bySortOrder(items) { return [...items].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)); }
function nextSortOrder(items) { return Math.max(-1, ...items.map(({ sortOrder }) => sortOrder ?? -1)) + 1; }

export default function CatalogEditor({ value, onChange, onDraftDirtyChange }) {
    const catalog = value ?? { categories: [], products: [] };
    const [activeCategoryId, setActiveCategoryId] = useState(null);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [dialog, setDialog] = useState(null);
    const [dialogDraft, setDialogDraft] = useState(null);
    const [dialogError, setDialogError] = useState('');
    const dialogRef = useRef(null);

    useEffect(() => {
        const element = dialogRef.current;
        if (!element) return;
        if (dialog && !element.open) element.showModal();
        else if (!dialog && element.open) element.close();
    }, [dialog]);

    const categories = useMemo(() => bySortOrder(catalog.categories), [catalog.categories]);
    const selectedCategoryId = activeCategoryId === UNCATEGORIZED || categories.some(({ id: categoryId }) => categoryId === activeCategoryId)
        ? activeCategoryId
        : categories[0]?.id ?? UNCATEGORIZED;
    const selectedCategory = categories.find(({ id: categoryId }) => categoryId === selectedCategoryId);
    const uncategorized = selectedCategoryId === UNCATEGORIZED;
    const products = useMemo(() => bySortOrder(catalog.products.filter((product) => uncategorized
        ? product.categoryId == null
        : product.categoryId === selectedCategoryId)), [catalog.products, selectedCategoryId, uncategorized]);
    const dialogDirty = Boolean(dialog && dialogDraft && JSON.stringify(dialogDraft) !== JSON.stringify(dialog.initial));
    const visibleProducts = products.filter((product) => (!filter || product.status === filter) && (!typeFilter || product.type === typeFilter) && `${product.name} ${product.description}`.toLocaleLowerCase('ru').includes(search.trim().toLocaleLowerCase('ru')));
    const page = useListPage(visibleProducts, `${selectedCategoryId}:${search}:${filter}:${typeFilter}`);
    useEffect(() => { onDraftDirtyChange?.(dialogDirty); }, [dialogDirty, onDraftDirtyChange]);

    function update(change) { onChange({ ...catalog, ...change }); }

    function openCategory(category = null) {
        const draft = category ? { ...category } : emptyCategory(nextSortOrder(categories));
        setDialogDraft(draft);
        setDialogError('');
        setDialog({ type: 'category', mode: category ? 'edit' : 'create', id: category?.id ?? null, initial: { ...draft } });
    }

    function openProduct(product = null) {
        const nextCategoryId = uncategorized ? null : selectedCategoryId;
        const nextOrder = nextSortOrder(products);
        const draft = product ? { ...product } : emptyProduct(nextCategoryId, nextOrder);
        setDialogDraft(draft);
        setDialogError('');
        setDialog({ type: 'product', mode: product ? 'edit' : 'create', id: product?.id ?? null, initial: { ...draft } });
    }

    function closeDialog(force = false) {
        if (!force && dialogDirty && !window.confirm('Отменить изменения? Несохранённые данные формы будут потеряны.')) return;
        setDialog(null);
        setDialogDraft(null);
        setDialogError('');
    }

    function handleDialogCancel(event) {
        event.preventDefault();
        closeDialog();
    }

    function saveDialog(event) {
        event.preventDefault();
        if (!dialog || !dialogDraft) return;
        const name = dialogDraft.name.trim();
        if (!name) {
            setDialogError(dialog.type === 'category' ? 'Укажите название раздела.' : 'Укажите название товара.');
            return;
        }

        if (dialog.type === 'category') {
            const category = { ...dialogDraft, name };
            update({ categories: dialog.mode === 'create'
                ? [...catalog.categories, category]
                : catalog.categories.map((item) => item.id === dialog.id ? category : item) });
            setActiveCategoryId(category.id);
        } else {
            let product = { ...dialogDraft, name };
            if (dialog.mode === 'create' || product.categoryId !== dialog.initial.categoryId) {
                const targetProducts = catalog.products.filter((item) => (item.categoryId || null) === (product.categoryId || null) && item.id !== product.id);
                product = { ...product, sortOrder: nextSortOrder(targetProducts) };
            }
            update({ products: dialog.mode === 'create'
                ? [...catalog.products, product]
                : catalog.products.map((item) => item.id === dialog.id ? product : item) });
        }

        closeDialog(true);
    }

    function deleteCategory(category) {
        if (!window.confirm(`Удалить раздел «${category.name}»? Его товары перейдут в «Без раздела».`)) return;
        update({
            categories: catalog.categories.filter(({ id: categoryId }) => categoryId !== category.id),
            products: catalog.products.map((product) => product.categoryId === category.id ? { ...product, categoryId: null } : product),
        });
        if (selectedCategoryId === category.id) {
            setActiveCategoryId(categories.find(({ id: categoryId }) => categoryId !== category.id)?.id ?? UNCATEGORIZED);
        }
    }

    function deleteProduct(product) {
        if (!window.confirm(`Удалить «${product.name || 'товар'}»?`)) return;
        update({ products: catalog.products.filter(({ id: productId }) => productId !== product.id) });
    }

    return <div className={styles.catalog}>
        <div className={styles.layout}>
            <div className={styles.categoryPanel}>
                <h2 className={styles.categoryHeading}>Разделы каталога</h2>
                <div className={styles.categoryList} role="group" aria-label="Разделы каталога">
                    {categories.map((category) => <div className={`${styles.categoryRow} ${selectedCategoryId === category.id ? styles.categoryActive : ''}`} key={category.id}>
                        <button className={styles.categorySelect} type="button" aria-current={selectedCategoryId === category.id ? 'true' : undefined} onClick={() => setActiveCategoryId(category.id)}>
                            <span title={category.name}>{category.name || 'Без названия'}</span>
                            <small>{catalog.products.filter(({ categoryId }) => categoryId === category.id).length}</small>
                        </button>
                        <div className={styles.categoryActions}>
                            <Button variant="iconCompact" title="Редактировать раздел" aria-label={`Редактировать раздел «${category.name}»`} onClick={() => openCategory(category)}><Icon name="edit" size={18} /></Button>
                            <Button variant="iconCompact" title="Удалить раздел" aria-label={`Удалить раздел «${category.name}»`} onClick={() => deleteCategory(category)}><Icon name="delete" size={18} /></Button>
                        </div>
                    </div>)}
                    <div className={`${styles.categoryRow} ${uncategorized ? styles.categoryActive : ''}`}>
                        <button className={styles.categorySelect} type="button" aria-current={uncategorized ? 'true' : undefined} onClick={() => setActiveCategoryId(UNCATEGORIZED)}>
                            <span>Без раздела</span>
                            <small>{catalog.products.filter(({ categoryId }) => categoryId == null).length}</small>
                        </button>
                    </div>
                </div>
                <button type="button" className={styles.addCategory} onClick={() => openCategory()}><Icon name="add" size={18} /> Добавить раздел</button>
            </div>

            <div className={styles.productPanel}>
                <div className={styles.productHeading}>
                    <div><h2>{selectedCategory?.name || 'Без раздела'}</h2><small>Товаров: {products.length}</small></div>
                </div>
                <AdminListToolbar actions={<Button variant="primary" size="compact" onClick={() => openProduct()}><Icon name="add" size={18} /> Добавить товар/услугу</Button>}>
                    <AdminListField label="Поиск"><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Название или описание" /></AdminListField>
                    <AdminListField label="Статус"><select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="">Все статусы</option><option value="published">Опубликованные</option><option value="hidden">Скрытые</option></select></AdminListField>
                    <AdminListField label="Тип"><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="">Все типы</option><option value="goods">Товары</option><option value="service">Услуги</option></select></AdminListField>
                </AdminListToolbar>
                    <Table className={styles.table} aria-label="Товары и услуги">
                        <thead><tr><th>Название</th><th>Тип</th><th>Цена</th><th>Статус</th><th><span className={styles.visuallyHidden}>Действия</span></th></tr></thead>
                        <tbody>
                            {page.items.map((product) => <tr key={product.id}>
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
                            {!visibleProducts.length && <tr><td className={listStyles.state} colSpan="5">{search || filter || typeFilter ? 'По заданным условиям ничего не найдено.' : 'В этом разделе пока нет товаров.'}</td></tr>}
                        </tbody>
                    </Table>
                <Pagination {...page.pagination} />
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
                        <input name="name" autoFocus required maxLength="200" value={dialogDraft.name} onChange={(event) => setDialogDraft((current) => ({ ...current, name: event.target.value }))} />
                    </label>
                    {dialogError && <p className={styles.dialogError} role="alert">{dialogError}</p>}
                </div> : <div className={`${styles.dialogBody} ${styles.productForm}`}>
                    <label className={`${fieldStyles.field} ${styles.fullField}`}>
                        <span>Название</span>
                        <input name="name" autoFocus required maxLength="200" value={dialogDraft.name} onChange={(event) => setDialogDraft((current) => ({ ...current, name: event.target.value }))} />
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
                    <Button variant="secondary" onClick={() => closeDialog()}>Отмена</Button>
                    <Button type="submit" variant="primary">Сохранить</Button>
                </footer>
            </ValidatedForm>}
        </dialog>
    </div>;
}
