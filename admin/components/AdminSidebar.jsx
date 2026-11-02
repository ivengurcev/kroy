import Icon from '../ui/Icon.jsx';
import styles from './AdminSidebar.module.css';

const groups = [
    { label: 'Основное', items: [
        { label: 'Редактор', path: '/admin', icon: 'home', match: (path) => path === '/admin' || /^\/admin\/pages\/(?!trash$)[^/]+$/.test(path) },
        { label: 'Страницы', path: '/admin/pages', icon: 'pages', match: (path) => path === '/admin/pages' || path === '/admin/pages/trash' },
    ] },
    { label: 'Содержимое', items: [
        { label: 'Материалы', path: '/admin/site/materials', icon: 'materials', match: (path) => path.startsWith('/admin/site/materials') },
        { label: 'Каталог', path: '/admin/site/catalog', icon: 'catalog', match: (path) => path === '/admin/site/catalog' },
        { label: 'Отзывы', path: '/admin/site/reviews', icon: 'reviews', match: (path) => path === '/admin/site/reviews' },
    ] },
    { label: 'Настройки', items: [
        { label: 'Оформление', path: '/admin/site', icon: 'sun', match: (path, search) => path === '/admin/site' && search.get('section') !== 'contacts' },
        { label: 'Контакты', path: '/admin/site?section=contacts', icon: 'phone', match: (path, search) => path === '/admin/site' && search.get('section') === 'contacts' },
        { label: 'Платежи', path: '/admin/site/payments', icon: 'payments', match: (path) => path === '/admin/site/payments' },
        { label: 'SEO', icon: 'seo', disabled: true },
    ] },
];

export default function AdminSidebar({ pathname, collapsed, mobileOpen, onNavigate }) {
    const search = new URLSearchParams(window.location.search);

    return (
        <>
            {mobileOpen && <button className={styles.backdrop} type="button" aria-label="Закрыть меню" onClick={onNavigate} />}
            <aside id="admin-sidebar" className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''} ${mobileOpen ? styles.mobileOpen : ''}`} aria-label="Навигация админки">
                <nav className={styles.inner}>
                    {groups.map((group) => (
                        <section className={styles.group} key={group.label} aria-label={group.label}>
                            <h2>{group.label}</h2>
                            {group.items.map((item) => {
                                const active = item.match?.(pathname, search);
                                const className = `${styles.item} ${active ? styles.active : ''}`;
                                return item.disabled ? (
                                    <button className={`${className} ${styles.disabled}`} type="button" disabled key={item.label} title={`${item.label} — скоро`}>
                                        <Icon name={item.icon} size={21} /><span>{item.label}</span>
                                    </button>
                                ) : (
                                    <a className={className} href={item.path} key={item.label} title={collapsed ? item.label : undefined} aria-current={active ? 'page' : undefined}>
                                        <Icon name={item.icon} size={21} /><span>{item.label}</span>
                                    </a>
                                );
                            })}
                        </section>
                    ))}
                </nav>
            </aside>
        </>
    );
}
