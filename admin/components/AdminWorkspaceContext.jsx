import { createContext, useContext, useEffect, useRef } from 'react';
import ApplicationContext from '@vyaz/core/Context.js';

const AdminWorkspaceContext = createContext(null);

export function useAdminHeader(config) {
    const workspace = useContext(AdminWorkspaceContext);
    const configRef = useRef(config);
    configRef.current = config;

    useEffect(() => {
        if (!workspace) return undefined;
        const current = configRef.current;
        return workspace.registerHeader({
            ...current,
            onSave: (...args) => configRef.current.onSave?.(...args),
            onPageDetailsChange: (...args) => configRef.current.onPageDetailsChange?.(...args),
        });
    }, [workspace, config.mode, config.title, config.page?.id, config.page?.path, config.isDirty, config.loadStatus, config.saveStatus, config.actions]);

    return workspace;
}

export function useAppNavigate() {
    return useContext(ApplicationContext)?.navigate;
}

export default AdminWorkspaceContext;
