import styles from './AdminPageShell.module.css';
import { useAdminHeader } from './AdminWorkspaceContext.jsx';
import ActionFooter from './ActionFooter.jsx';
import Button from '../ui/Button.jsx';
import Icon from '../ui/Icon.jsx';

export default function AdminPageShell({
    title,
    actions,
    status = 'success',
    errorMessage,
    headerMode = 'pages',
    isDirty = false,
    saveStatus = 'idle',
    onSave,
    footerActions,
    formId,
    children,
}) {
    useAdminHeader({ mode: headerMode, title, isDirty, loadStatus: status, saveStatus, onSave });

    return (
        <div className={styles.page}>
            {actions && <div className={styles.actions}>{actions}</div>}
            {status === 'loading' && <p className={styles.status} role="status">Загрузка…</p>}
            {status === 'error' && <p className={styles.status} role="alert">{errorMessage}</p>}
            {status === 'success' && children}
            {status === 'success' && <ActionFooter isDirty={isDirty} saveStatus={saveStatus}>
                {footerActions || (onSave && <Button type={formId ? 'submit' : 'button'} form={formId} variant="primary" disabled={!isDirty || saveStatus === 'saving'} onClick={formId ? undefined : onSave}><Icon name="save" /> Сохранить</Button>)}
            </ActionFooter>}
        </div>
    );
}
