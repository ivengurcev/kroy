import styles from './AdminPageShell.module.css';
import { useAdminHeader } from './AdminWorkspaceContext.jsx';
import ActionFooter from './ActionFooter.jsx';
import Button from '../ui/Button.jsx';
import Icon from '../ui/Icon.jsx';
import AdminPageHeader from './AdminPageHeader.jsx';
import listStyles from './AdminList.module.css';

export default function AdminPageShell({
    title,
    list = false,
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
    useAdminHeader({ mode: headerMode, title, list, isDirty, loadStatus: status, saveStatus, onSave });

    return (
        <div className={list ? listStyles.page : styles.page} data-admin-list={list || undefined}>
            {list && <AdminPageHeader title={title} compact />}
            {actions && <div className={styles.actions}>{actions}</div>}
            {status === 'loading' && <p className={list ? listStyles.state : styles.status} role="status">Загрузка…</p>}
            {status === 'error' && <p className={list ? listStyles.error : styles.status} role="alert">{errorMessage}</p>}
            {status === 'success' && children}
            {!list && status === 'success' && <ActionFooter isDirty={isDirty} saveStatus={saveStatus}>
                {footerActions || (onSave && <Button type={formId ? 'submit' : 'button'} form={formId} variant="primary" disabled={!isDirty || saveStatus === 'saving'} onClick={formId ? undefined : onSave}><Icon name="save" /> Сохранить</Button>)}
            </ActionFooter>}
        </div>
    );
}
