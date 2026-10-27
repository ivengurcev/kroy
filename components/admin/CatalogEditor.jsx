import { useState } from 'react';
import Button from '../ui/Button.jsx';
import Card from '../ui/Card.jsx';
import Icon from '../ui/Icon.jsx';
import ImageField from '../../editor/ImageField.jsx';
import styles from './CatalogEditor.module.css';

function id() { return globalThis.crypto?.randomUUID?.() ?? `local-${Date.now()}-${Math.random().toString(16).slice(2)}`; }

function emptyProduct(categoryId = null) {
    return { id: id(), categoryId, name: '', description: '', mediaId: null, price: '0.00', paymentUrl: '', sortOrder: 0, status: 'published' };
}

function emptyCategory() { return { id: id(), name: 'Новая категория', sortOrder: 0 }; }

export default function CatalogEditor({ value, onChange }) {
    const catalog = value ?? { categories: [], products: [] };
    const [collapsed, setCollapsed] = useState({});
    const [selection, setSelection] = useState(null);
    const selectedProduct = selection?.type === 'product' ? catalog.products.find((item) => item.id === selection.id) : null;
    const selectedCategory = selection?.type === 'category' ? catalog.categories.find((item) => item.id === selection.id) : null;
    const uncategorized = catalog.products.filter((item) => !item.categoryId);
    const productsIn = (categoryId) => catalog.products.filter((item) => item.categoryId === categoryId);

    function update(change) { onChange({ ...catalog, ...change }); }
    function updateProduct(idValue, change) { update({ products: catalog.products.map((item) => item.id === idValue ? { ...item, ...change } : item) }); }
    function updateCategory(idValue, change) { update({ categories: catalog.categories.map((item) => item.id === idValue ? { ...item, ...change } : item) }); }
    function addCategory() { const category = emptyCategory(); update({ categories: [...catalog.categories, category] }); setSelection({ type: 'category', id: category.id }); }
    function addProduct() { const product = emptyProduct(); update({ products: [...catalog.products, product] }); setSelection({ type: 'product', id: product.id }); }
    function removeProduct(idValue) { update({ products: catalog.products.filter((item) => item.id !== idValue) }); setSelection(null); }
    function removeCategory(idValue) { update({ categories: catalog.categories.filter((item) => item.id !== idValue), products: catalog.products.map((item) => item.categoryId === idValue ? { ...item, categoryId: null } : item) }); setSelection(null); }
    function moveProduct(product, direction) {
        const list = productsIn(product.categoryId);
        const index = list.findIndex((item) => item.id === product.id); const target = index + direction;
        if (target < 0 || target >= list.length) return;
        const reordered = [...list]; [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
        const order = new Map(reordered.map((item, itemIndex) => [item.id, itemIndex]));
        update({ products: catalog.products.map((item) => order.has(item.id) ? { ...item, sortOrder: order.get(item.id) } : item) });
    }
    function moveCategory(index, direction) {
        const target = index + direction; if (target < 0 || target >= catalog.categories.length) return;
        const categories = [...catalog.categories]; [categories[index], categories[target]] = [categories[target], categories[index]];
        update({ categories: categories.map((item, itemIndex) => ({ ...item, sortOrder: itemIndex })) });
    }

    function treeProduct(product, index, list) {
        return <div className={styles.productRow} key={product.id}><button className={`${styles.treeItem} ${selection?.id === product.id ? styles.selected : ''}`} type="button" onClick={() => setSelection({ type: 'product', id: product.id })}><span>{product.name || 'Новый товар/услуга'}</span><small>{product.status === 'hidden' ? 'Скрыт' : product.price} ₽</small></button><div className={styles.order}><Button variant="compact" title="Выше" disabled={!index} onClick={() => moveProduct(product, -1)}><Icon name="up" /></Button><Button variant="compact" title="Ниже" disabled={index === list.length - 1} onClick={() => moveProduct(product, 1)}><Icon name="down" /></Button></div></div>;
    }

    return <div className={styles.catalog}>
        <div className={styles.toolbar}><Button onClick={addCategory}><Icon name="add" /> Добавить категорию</Button><Button onClick={addProduct}><Icon name="add" /> Добавить товар/услугу</Button></div>
        <div className={styles.layout}>
            <Card className={styles.tree}>
                {catalog.categories.map((category, index) => <div className={styles.group} key={category.id}>
                    <div className={styles.categoryRow}>
                        <button className={styles.toggle} type="button" aria-label={collapsed[category.id] ? 'Развернуть категорию' : 'Свернуть категорию'} onClick={() => setCollapsed((current) => ({ ...current, [category.id]: !current[category.id] }))}>{collapsed[category.id] ? '▸' : '▾'}</button>
                        <button className={`${styles.categoryName} ${selection?.id === category.id ? styles.selected : ''}`} type="button" onClick={() => setSelection({ type: 'category', id: category.id })}>{category.name || 'Без названия'} <small>{productsIn(category.id).length}</small></button>
                        <div className={styles.order}><Button variant="compact" title="Выше" disabled={!index} onClick={() => moveCategory(index, -1)}><Icon name="up" /></Button><Button variant="compact" title="Ниже" disabled={index === catalog.categories.length - 1} onClick={() => moveCategory(index, 1)}><Icon name="down" /></Button></div>
                    </div>
                    {!collapsed[category.id] && <div className={styles.children}>{productsIn(category.id).map((product, productIndex, list) => treeProduct(product, productIndex, list))}</div>}
                </div>)}
                <div className={styles.group}><div className={styles.categoryRow}><span className={styles.toggle} aria-hidden="true">•</span><strong className={styles.categoryName}>Без категории <small>{uncategorized.length}</small></strong></div>{uncategorized.length > 0 && <div className={styles.children}>{uncategorized.map((product, productIndex, list) => treeProduct(product, productIndex, list))}</div>}</div>
            </Card>
            <Card className={styles.editor}>
                {selectedCategory && <><h2>Категория</h2><label className={styles.field}><span>Название</span><input value={selectedCategory.name} onChange={(event) => updateCategory(selectedCategory.id, { name: event.target.value })} /></label><Button variant="danger" onClick={() => removeCategory(selectedCategory.id)}><Icon name="delete" /> Удалить категорию</Button></>}
                {selectedProduct && <><h2>Товар/услуга</h2><label className={styles.field}><span>Название</span><input value={selectedProduct.name} onChange={(event) => updateProduct(selectedProduct.id, { name: event.target.value })} /></label><label className={styles.field}><span>Описание</span><textarea rows="4" value={selectedProduct.description} onChange={(event) => updateProduct(selectedProduct.id, { description: event.target.value })} /></label><ImageField label="Изображение" value={selectedProduct.mediaId ? `/api/media/${selectedProduct.mediaId}` : ''} onChange={(url) => updateProduct(selectedProduct.id, { mediaId: url.split('/').pop() || null })} /><label className={styles.field}><span>Цена, ₽</span><input inputMode="decimal" value={selectedProduct.price} onChange={(event) => updateProduct(selectedProduct.id, { price: event.target.value })} /></label><label className={styles.field}><span>Ссылка Prodamus</span><input type="url" value={selectedProduct.paymentUrl} onChange={(event) => updateProduct(selectedProduct.id, { paymentUrl: event.target.value })} /></label><label className={styles.field}><span>Категория</span><select value={selectedProduct.categoryId ?? ''} onChange={(event) => updateProduct(selectedProduct.id, { categoryId: event.target.value || null })}><option value="">Без категории</option>{catalog.categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label><label className={styles.checkbox}><input type="checkbox" checked={selectedProduct.status === 'published'} onChange={(event) => updateProduct(selectedProduct.id, { status: event.target.checked ? 'published' : 'hidden' })} /> Опубликован</label><div className={styles.editorActions}><Button variant="danger" onClick={() => removeProduct(selectedProduct.id)}><Icon name="delete" /> Удалить</Button><Button onClick={() => setSelection(null)}>Готово</Button></div></>}
                {!selectedCategory && !selectedProduct && <p className={styles.empty}>Выберите категорию или товар.</p>}
            </Card>
        </div>
    </div>;
}
