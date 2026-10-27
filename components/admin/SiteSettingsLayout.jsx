import { useEffect, useRef, useState } from 'react';
import AdminPageShell from './AdminPageShell.jsx';
import Button from '../ui/Button.jsx';
import Icon from '../ui/Icon.jsx';
import styles from './SiteSettingsLayout.module.css';

export const SITE_SETTINGS_SECTIONS = [
    { id: 'overview', label: 'Главное', icon: 'home' },
    { id: 'appearance', label: 'Внешний вид', icon: 'sun' },
    { id: 'contacts', label: 'Контактная информация', icon: 'phone' },
    { id: 'catalog', label: 'Каталог', icon: 'pages' },
    { id: 'seo', label: 'SEO', icon: 'seo' },
];

export default function SiteSettingsLayout({
    section,
    title,
    status,
    errorMessage,
    isDirty,
    saveStatus,
    onSave,
    onSectionChange,
    children,
}) {
    const [menuOpen, setMenuOpen] = useState(false);
    const menuButtonRef = useRef(null);
    const menuRef = useRef(null);

    function closeMenu() {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
    }

    useEffect(() => {
        if (!menuOpen) return undefined;

        function closeOnEscape(event) {
            if (event.key === 'Escape') {
                event.preventDefault();
                closeMenu();
            }
        }

        document.addEventListener('keydown', closeOnEscape);
        menuRef.current?.querySelector('button')?.focus();
        return () => document.removeEventListener('keydown', closeOnEscape);
    }, [menuOpen]);

    function selectSection(nextSection) {
        onSectionChange(nextSection);
        closeMenu();
    }

    return (
        <AdminPageShell
            title={title}
            headerMode="site"
            status={status}
            errorMessage={errorMessage}
            isDirty={isDirty}
            saveStatus={saveStatus}
            onSave={onSave}
        >
            <div className={styles.mobileHeading}>
                <Button
                    className={styles.menuButton}
                    variant="compact"
                    ref={menuButtonRef}
                    aria-label="Открыть меню настроек сайта"
                    aria-controls="site-settings-navigation"
                    aria-expanded={menuOpen}
                    title="Открыть меню настроек сайта"
                    onClick={() => setMenuOpen(true)}
                >
                    <Icon name="more" />
                </Button>
            </div>

            {menuOpen && <button className={styles.backdrop} type="button" aria-label="Закрыть меню" onClick={closeMenu} />}
            <div className={`${styles.settings} ${menuOpen ? styles.settingsOpen : ''}`}>
                <aside
                    className={styles.navigation}
                    id="site-settings-navigation"
                    ref={menuRef}
                    aria-label="Разделы настроек сайта"
                >
                    {SITE_SETTINGS_SECTIONS.map((item) => (
                        <button
                            className={section === item.id ? styles.active : ''}
                            type="button"
                            aria-current={section === item.id ? 'page' : undefined}
                            key={item.id}
                            onClick={() => selectSection(item.id)}
                        >
                            <Icon name={item.icon} size={18} />
                            <span>{item.label}</span>
                        </button>
                    ))}
                </aside>
                <section className={styles.page} aria-labelledby="site-settings-title">
                    <h1 id="site-settings-title">{title}</h1>
                    {children}
                </section>
            </div>
        </AdminPageShell>
    );
}
