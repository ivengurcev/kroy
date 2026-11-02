import { lazy, Suspense, useContext } from 'react';
import ApplicationContext from '@vyaz/core/Context.js';

const AdminApplicationClient = lazy(() => import('./AdminApplicationClient.jsx'));

export default function AdminApplication({ children }) {
    const { pathname } = useContext(ApplicationContext) || {};

    if (!pathname?.startsWith('/admin') || pathname === '/admin/preview') return children;

    return (
        <Suspense fallback={null}>
            <AdminApplicationClient>{children}</AdminApplicationClient>
        </Suspense>
    );
}
