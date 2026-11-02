import AdminPageShell from './AdminPageShell.jsx';

export const SITE_SETTINGS_SECTIONS = [
    { id: 'overview', label: 'Главное', icon: 'home' },
    { id: 'appearance', label: 'Оформление', icon: 'sun' },
    { id: 'contacts', label: 'Контакты', icon: 'phone' },
    { id: 'catalog', label: 'Каталог', icon: 'catalog', path: '/admin/site/catalog' },
    { id: 'payments', label: 'Платежи', icon: 'payments', path: '/admin/site/payments' },
    { id: 'reviews', label: 'Отзывы', icon: 'reviews', path: '/admin/site/reviews' },
    { id: 'materials', label: 'Материалы', icon: 'materials', path: '/admin/site/materials' },
    { id: 'seo', label: 'SEO', icon: 'seo' },
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
