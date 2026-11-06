import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import ApplicationContext from '@vyaz/core/Context.js';
import AdminHeader from './AdminHeader.jsx';
import AdminLayout from './AdminLayout.jsx';
import AdminSidebar from './AdminSidebar.jsx';
import AdminWorkspaceContext from './AdminWorkspaceContext.jsx';

const EMPTY_HEADER = { mode: 'pages', title: '', isDirty: false, loadStatus: 'success', saveStatus: 'idle' };

export default function AdminApplication({ children }) {
    const { navigate, pathname, setNavigationGuard } = useContext(ApplicationContext) || {};
    const [header, setHeader] = useState(EMPTY_HEADER);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const headerRef = useRef(header);
    const allowUnloadRef = useRef(false);
    headerRef.current = header;

    const registerHeader = useCallback((config) => {
        const token = Symbol('admin-header');
        headerRef.current = { ...config, token };
        setHeader(headerRef.current);
        return () => {
            if (headerRef.current.token === token) {
                headerRef.current = EMPTY_HEADER;
                setHeader(EMPTY_HEADER);
            }
        };
    }, []);
    const workspace = useMemo(() => ({ registerHeader }), [registerHeader]);

    const confirmNavigation = useCallback(() => {
        const current = headerRef.current;
        return !current.isDirty || window.confirm('Есть несохранённые изменения. Перейти без сохранения?');
    }, []);

    useEffect(() => {
        setNavigationGuard?.(confirmNavigation);
        return () => setNavigationGuard?.(null);
    }, [confirmNavigation, setNavigationGuard]);

    useEffect(() => {
        function warnBeforeUnload(event) {
            if (!headerRef.current.isDirty || allowUnloadRef.current) return;
            event.preventDefault();
            event.returnValue = '';
        }

        window.addEventListener('beforeunload', warnBeforeUnload);
        return () => window.removeEventListener('beforeunload', warnBeforeUnload);
    }, []);

    useEffect(() => {
        function closeOnEscape(event) {
            if (event.key === 'Escape') setMobileMenuOpen(false);
        }
        function closeOnDesktop() {
            if (!window.matchMedia('(max-width: 820px)').matches) setMobileMenuOpen(false);
        }
        document.addEventListener('keydown', closeOnEscape);
        window.addEventListener('resize', closeOnDesktop);
        return () => {
            document.removeEventListener('keydown', closeOnEscape);
            window.removeEventListener('resize', closeOnDesktop);
        };
    }, []);

    function handleNavigationClick(event) {
        const anchor = event.target.closest?.('a[href]');
        if (!anchor || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        if (anchor.target && anchor.target !== '_self' || anchor.hasAttribute('download')) return;
        const target = new URL(anchor.href, window.location.href);
        if (target.origin !== window.location.origin || !target.pathname.startsWith('/admin') || target.pathname === '/admin/preview') return;
        event.preventDefault();
        navigate?.(`${target.pathname}${target.search}${target.hash}`);
        setMobileMenuOpen(false);
    }

    if (!pathname?.startsWith('/admin') || pathname === '/admin/preview') return children;

    return (
        <AdminWorkspaceContext.Provider value={workspace}>
            <div onClick={handleNavigationClick}>
                <AdminLayout
                    header={(
                        <AdminHeader
                            {...header}
                            sidebarCollapsed={sidebarCollapsed}
                            mobileMenuOpen={mobileMenuOpen}
                            onToggleSidebar={() => setSidebarCollapsed((value) => !value)}
                            onToggleMobileMenu={() => setMobileMenuOpen((value) => !value)}
                            onAllowUnload={() => { allowUnloadRef.current = true; }}
                        />
                    )}
                    sidebar={<AdminSidebar pathname={pathname} collapsed={sidebarCollapsed} mobileOpen={mobileMenuOpen} onNavigate={() => setMobileMenuOpen(false)} />}
                    sidebarCollapsed={sidebarCollapsed}
                    mobileMenuOpen={mobileMenuOpen}
                    onCloseMobileMenu={() => setMobileMenuOpen(false)}
                >
                    <div key={pathname}>{children}</div>
                </AdminLayout>
            </div>
        </AdminWorkspaceContext.Provider>
    );
}
