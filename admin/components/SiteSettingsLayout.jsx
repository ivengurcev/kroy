import AdminPageShell from './AdminPageShell.jsx';

export const SITE_SETTINGS_SECTIONS = [
    { id: 'overview', label: 'Главное', icon: 'home', path: '/admin/overview' },
    { id: 'appearance', label: 'Оформление', icon: 'sun', path: '/admin/appearance' },
    { id: 'contacts', label: 'Контакты', icon: 'phone', path: '/admin/contacts' },
    { id: 'catalog', label: 'Каталог', icon: 'catalog', path: '/admin/catalog' },
    { id: 'payments', label: 'Платежи', icon: 'payments', path: '/admin/payments' },
    { id: 'reviews', label: 'Отзывы', icon: 'reviews', path: '/admin/reviews' },
    { id: 'materials', label: 'Материалы', icon: 'materials', path: '/admin/materials' },
    { id: 'seo', label: 'SEO', icon: 'seo', path: '/admin/seo' },
];

export default function SiteSettingsLayout({
    title,
    actions,
    status,
    errorMessage,
    isDirty,
    saveStatus,
    onSave,
    children,
}) {
    return (
        <AdminPageShell
            title={title}
            actions={actions}
            headerMode="site"
            status={status}
            errorMessage={errorMessage}
            isDirty={isDirty}
            saveStatus={saveStatus}
            onSave={onSave}
        >
            {children}
        </AdminPageShell>
    );
}
