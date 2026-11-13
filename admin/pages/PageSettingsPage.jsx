import { useContext, useEffect, useState } from 'react';
import ApplicationContext from '@vyaz/core/Context.js';
import AdminPageShell from '../components/AdminPageShell.jsx';
import AdminPageHeader from '../components/AdminPageHeader.jsx';
import PageDetailsForm from '../components/PageDetailsForm.jsx';
import Button from '../ui/Button.jsx';
import Icon from '../ui/Icon.jsx';
import styles from './PageSettingsPage.module.css';

const EMPTY_PAGE = { title: '', path: '', type: 'standard', seo: {} };

export default function PageSettingsPage() {
    const { pathname, navigate } = useContext(ApplicationContext) || {};
    const isNew = pathname === '/admin/pages/new';
    const pageId = pathname?.split('/')[3];
    const [page, setPage] = useState(isNew ? EMPTY_PAGE : null);
    const [status, setStatus] = useState(isNew ? 'success' : 'loading');
    const [dirty, setDirty] = useState(false);
    const [saveStatus, setSaveStatus] = useState('idle');
    useEffect(() => {
        if (isNew) return;
        const controller = new AbortController();
        fetch(`/api/pages/${pageId}`, { signal: controller.signal }).then((response) => {
            if (!response.ok) throw new Error();
            return response.json();
        }).then((result) => { setPage(result); setStatus('success'); }).catch((error) => {
            if (error.name !== 'AbortError') setStatus('error');
        });
        return () => controller.abort();
    }, [pageId, isNew]);
    return <AdminPageShell title={isNew ? 'Новая страница' : page?.title || 'Настройки страницы'}
        status={status} errorMessage="Не удалось загрузить страницу." isDirty={dirty} saveStatus={saveStatus}
        formId="page-settings-form" onSave={() => document.getElementById('page-settings-form')?.requestSubmit()}>
        <div className={styles.content}>
            <Button onClick={() => navigate?.('/admin/pages')}><Icon name="back" /> К списку страниц</Button>
            <AdminPageHeader title={isNew ? 'Новая страница' : page?.title} />
            {!isNew && <p className={styles.path}>{page?.path}</p>}
            {page && <PageDetailsForm page={page} formId="page-settings-form" hideActions handleEscape={false}
                onDirtyChange={setDirty} onSaveStatusChange={setSaveStatus}
                onSaved={(result) => {
                    if (isNew) navigate?.(`/admin/pages/${result.id}/settings`, { skipGuard: true });
                    else setPage(result);
                }} />}
            {saveStatus === 'success' && <p role="status">Сохранено</p>}
        </div>
    </AdminPageShell>;
}
