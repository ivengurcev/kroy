import { useEffect, useRef, useState } from 'react';
import Button from '../ui/Button.jsx';
import Card from '../ui/Card.jsx';
import Icon from '../ui/Icon.jsx';
import ImageField from '../../editor/ImageField.jsx';
import compactStyles from '../ui/CompactForm.module.css';
import styles from './CatalogEditor.module.css';

function id() { return globalThis.crypto?.randomUUID?.() ?? `local-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function emptyProduct(categoryId = null) { return { id: id(), categoryId, name: '', description: '', mediaId: null, price: '0.00', paymentUrl: '', sortOrder: 0, status: 'published' }; }
function emptyCategory() { return { id: id(), name: 'Новая категория', sortOrder: 0 }; }

export default function CatalogEditor({ value, onChange }) {
    const catalog = value ?? { categories: [], products: [] };
    const [collapsed, setCollapsed] = useState({});
    const [selection, setSelection] = useState(null);
    const [menu, setMenu] = useState(null);
    const menuRef = useRef(null);
    const selectedProduct = selection?.type === 'product' ? catalog.products.find((item) => item.id === selection.id) : null;
    const selectedCategory = selection?.type === 'category' ? catalog.categories.find((item) => item.id === selection.id) : null;
    const uncategorized = catalog.products.filter((item) => !item.categoryId);
    const productsIn = (categoryId) => catalog.products.filter((item) => item.categoryId === categoryId);

    useEffect(() => {
        if (!menu) return undefined;
        function close(event) { if (!menuRef.current?.contains(event.target)) setMenu(null); }
        function closeEscape(event) { if (event.key === 'Escape') setMenu(null); }
        document.addEventListener('pointerdown', close, true);
        document.addEventListener('keydown', closeEscape);
        return () => { document.removeEventListener('pointerdown', close, true); document.removeEventListener('keydown', closeEscape); };
    }, [menu]);

    function update(change) { onChange({ ...catalog, ...change }); }
    function updateProduct(idValue, change) { update({ products: catalog.products.map((item) => item.id === idValue ? { ...item, ...change } : item) }); }
    function updateCategory(idValue, change) { update({ categories: catalog.categories.map((item) => item.id === idValue ? { ...item, ...change } : item) }); }
    function addCategory() { const category = emptyCategory(); update({ categories: [...catalog.categories, category] }); setSelection({ type: 'category', id: category.id }); }
    function addProduct(categoryId = null) { const product = emptyProduct(categoryId); update({ products: [...catalog.products, product] }); setSelection({ type: 'product', id: product.id }); setMenu(null); }
    function removeProduct(idValue) { update({ products: catalog.products.filter((item) => item.id !== idValue) }); setSelection(null); setMenu(null); }
    function removeCategory(idValue) { update({ categories: catalog.categories.filter((item) => item.id !== idValue), products: catalog.products.map((item) => item.categoryId === idValue ? { ...item, categoryId: null } : item) }); setSelection(null); setMenu(null); }
    function moveProduct(product, direction) {
        const list = productsIn(product.categoryId); const index = list.findIndex((item) => item.id === product.id); const target = index + direction;
        if (target < 0 || target >= list.length) return;
        const reordered = [...list]; [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
        const order = new Map(reordered.map((item, itemIndex) => [item.id, itemIndex]));
        update({ products: catalog.products.map((item) => order.has(item.id) ? { ...item, sortOrder: order.get(item.id) } : item) }); setMenu(null);
    }
    function moveCategory(index, direction) {
        const target = index + direction; if (target < 0 || target >= catalog.categories.length) return;
        const categories = [...catalog.categories]; [categories[index], categories[target]] = [categories[target], categories[index]];
        update({ categories: categories.map((item, itemIndex) => ({ ...item, sortOrder: itemIndex })) }); setMenu(null);
    }
    function actionsMenu(key, children) { return menu === key ? <div className={styles.menu} ref={menuRef} role="menu">{children}</div> : null; }

    function treeProduct(product, index, list) {
        const key = `product:${product.id}`;
        return <div className={styles.productRow} key={product.id}>
            <button className={`${styles.treeItem} ${selection?.id === product.id ? styles.selected : ''}`} type="button" onClick={() => { setSelection({ type: 'product', id: product.id }); setMenu(null); }}><span>{product.name || 'Новый товар/услуга'}</span><small>{product.status === 'hidden' ? 'Скрыт' : product.price} ₽</small></button>
            <Button className={styles.menuTrigger} variant="compact" aria-label="Действия с товаром" title="Действия с товаром" aria-haspopup="menu" aria-expanded={menu === key} onClick={() => setMenu(menu === key ? null : key)}><Icon name="more" /></Button>
            {actionsMenu(key, <><Button role="menuitem" title="Переместить выше" disabled={!index} onClick={() => moveProduct(product, -1)}><Icon name="up" /> Выше</Button><Button role="menuitem" title="Переместить ниже" disabled={index === list.length - 1} onClick={() => moveProduct(product, 1)}><Icon name="down" /> Ниже</Button><Button role="menuitem" title="Удалить товар" onClick={() => removeProduct(product.id)}><Icon name="delete" /> Удалить</Button></>)}
        </div>;
    }

    function treeCategory(category, index) {
        const key = `category:${category.id}`;
        return <div className={styles.group} key={category.id}>
            <div className={styles.categoryRow}>
                <button className={styles.toggle} type="button" aria-label={collapsed[category.id] ? 'Развернуть категорию' : 'Свернуть категорию'} onClick={() => setCollapsed((current) => ({ ...current, [category.id]: !current[category.id] }))}>{collapsed[category.id] ? '▸' : '▾'}</button>
                <button className={`${styles.categoryName} ${selection?.id === category.id ? styles.selected : ''}`} type="button" onClick={() => { setSelection({ type: 'category', id: category.id }); setMenu(null); }}>{category.name || 'Без названия'} <small>{productsIn(category.id).length}</small></button>
                <Button className={styles.addItem} variant="compact" aria-label={`Добавить товар в категорию ${category.name || 'без названия'}`} title="Добавить товар в категорию" onClick={() => addProduct(category.id)}><Icon name="add" size={16} /></Button>
                <Button className={styles.menuTrigger} variant="compact" aria-label="Действия с категорией" title="Действия с категорией" aria-haspopup="menu" aria-expanded={menu === key} onClick={() => setMenu(menu === key ? null : key)}><Icon name="more" /></Button>
                {actionsMenu(key, <><Button role="menuitem" title="Переместить выше" disabled={!index} onClick={() => moveCategory(index, -1)}><Icon name="up" /> Выше</Button><Button role="menuitem" title="Переместить ниже" disabled={index === catalog.categories.length - 1} onClick={() => moveCategory(index, 1)}><Icon name="down" /> Ниже</Button><Button role="menuitem" title="Удалить категорию" onClick={() => removeCategory(category.id)}><Icon name="delete" /> Удалить</Button></>)}
            </div>
            {!collapsed[category.id] && <div className={styles.children}>{productsIn(category.id).map((product, productIndex, list) => treeProduct(product, productIndex, list))}</div>}
        </div>;
    }

    return <div className={styles.catalog}>
        <div className={styles.toolbar}><Button onClick={addCategory}><Icon name="add" /> Добавить категорию</Button><Button onClick={() => addProduct()}><Icon name="add" /> Добавить товар/услугу</Button></div>
        <div className={`${styles.layout} ${selection ? styles.hasSelection : ''}`}>
            <Card className={styles.tree}>{catalog.categories.map(treeCategory)}<div className={styles.group}><div className={styles.categoryRow}><span className={styles.toggle} aria-hidden="true">•</span><strong className={styles.categoryName}>Без категории <small>{uncategorized.length}</small></strong></div>{uncategorized.length > 0 && <div className={styles.children}>{uncategorized.map((product, productIndex, list) => treeProduct(product, productIndex, list))}</div>}</div></Card>
            <Card className={styles.editor}>
                {selection && <Button className={styles.backButton} variant="compact" onClick={() => setSelection(null)}><Icon name="back" /> Назад к каталогу</Button>}
                {selectedCategory && <><h2>Категория</h2><label className={`${styles.field} ${compactStyles.field} ${compactStyles.compact}`}><span>Название</span><input value={selectedCategory.name} onChange={(event) => updateCategory(selectedCategory.id, { name: event.target.value })} /></label><Button variant="danger" onClick={() => removeCategory(selectedCategory.id)}><Icon name="delete" /> Удалить категорию</Button></>}
                {selectedProduct && <><h2>Товар/услуга</h2><label className={`${styles.field} ${compactStyles.field} ${compactStyles.compact}`}><span>Название</span><input value={selectedProduct.name} onChange={(event) => updateProduct(selectedProduct.id, { name: event.target.value })} /></label><label className={`${styles.field} ${compactStyles.field} ${compactStyles.long}`}><span>Описание</span><textarea rows="4" value={selectedProduct.description} onChange={(event) => updateProduct(selectedProduct.id, { description: event.target.value })} /></label><ImageField label="Изображение" value={selectedProduct.mediaId ? `/api/media/${selectedProduct.mediaId}` : ''} aspectRatio="4:3" maxWidth={1200} onChange={(url) => updateProduct(selectedProduct.id, { mediaId: url.split('/').pop() || null })} /><label className={`${styles.field} ${compactStyles.field} ${compactStyles.compact}`}><span>Цена, ₽</span><input inputMode="decimal" value={selectedProduct.price} onChange={(event) => updateProduct(selectedProduct.id, { price: event.target.value })} /></label><label className={`${styles.field} ${compactStyles.field} ${compactStyles.compact}`}><span>Ссылка Prodamus</span><input type="url" value={selectedProduct.paymentUrl} onChange={(event) => updateProduct(selectedProduct.id, { paymentUrl: event.target.value })} /></label><label className={`${styles.field} ${compactStyles.field} ${compactStyles.compact}`}><span>Категория</span><select value={selectedProduct.categoryId ?? ''} onChange={(event) => updateProduct(selectedProduct.id, { categoryId: event.target.value || null })}><option value="">Без категории</option>{catalog.categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label><label className={`${styles.checkbox} ${compactStyles.checkbox}`}><input type="checkbox" checked={selectedProduct.status === 'published'} onChange={(event) => updateProduct(selectedProduct.id, { status: event.target.checked ? 'published' : 'hidden' })} /> Опубликован</label><div className={styles.editorActions}><Button variant="danger" onClick={() => removeProduct(selectedProduct.id)}><Icon name="delete" /> Удалить</Button><Button onClick={() => setSelection(null)}>Готово</Button></div></>}
                {!selectedCategory && !selectedProduct && <p className={styles.empty}>Выберите категорию или товар.</p>}
            </Card>
        </div>
    </div>;
}
