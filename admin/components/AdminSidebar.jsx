import Icon from '../ui/Icon.jsx';
import styles from './AdminSidebar.module.css';

const groups = [
    { label: 'Основное', items: [
        { label: 'Страницы', path: '/admin/pages', icon: 'pages', match: (path) => path === '/admin' || path === '/admin/pages' || path.startsWith('/admin/pages/') },
    ] },
    { label: 'Содержимое', items: [
        { label: 'Материалы', path: '/admin/materials', icon: 'materials', match: (path) => path === '/admin/materials' || path.startsWith('/admin/materials/') },
        { label: 'Каталог', path: '/admin/catalog', icon: 'catalog', match: (path) => path === '/admin/catalog' },
        { label: 'Отзывы', path: '/admin/reviews', icon: 'reviews', match: (path) => path === '/admin/reviews' },
    ] },
    { label: 'Настройки', items: [
        { label: 'Оформление', path: '/admin/appearance', icon: 'sun', match: (path) => path === '/admin/appearance' },
        { label: 'Контакты', path: '/admin/contacts', icon: 'phone', match: (path) => path === '/admin/contacts' },
        { label: 'Платежи', path: '/admin/payments', icon: 'payments', match: (path) => path === '/admin/payments' },
        { label: 'SEO', path: '/admin/seo', icon: 'seo', match: (path) => path === '/admin/seo' },
    ] },
];

export default function AdminSidebar({ pathname, collapsed, mobileOpen, onNavigate }) {
    return (
        <>
            {mobileOpen && <button className={styles.backdrop} type="button" aria-label="Закрыть меню" onClick={onNavigate} />}
            <aside id="admin-sidebar" className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''} ${mobileOpen ? styles.mobileOpen : ''}`} aria-label="Навигация админки">
                <nav className={styles.inner}>
                    {groups.map((group) => (
                        <section className={styles.group} key={group.label} aria-label={group.label}>
                            <h2>{group.label}</h2>
                            {group.items.map((item) => {
                                const active = item.match?.(pathname);
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
