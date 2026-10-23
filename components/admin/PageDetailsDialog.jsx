import { useEffect, useRef } from 'react';
import PageDetailsForm from './PageDetailsForm.jsx';
import Tabs from '../ui/Tabs.jsx';
import styles from './PageDetailsDialog.module.css';

const tabs = [
    { label: 'Основное' },
    { label: 'SEO' },
    { label: 'Дополнительно' },
];

export default function PageDetailsDialog({ page, onSaved, onCancel }) {
    const dialogRef = useRef(null);

    useEffect(() => {
        dialogRef.current?.showModal();
    }, []);

    return (
        <dialog
            className={styles.dialog}
            ref={dialogRef}
            aria-labelledby="page-details-title"
            onCancel={(event) => event.preventDefault()}
        >
            <h2 id="page-details-title">Настройки страницы</h2>
            <Tabs className={styles.tabs} items={tabs} ariaLabel="Разделы настроек страницы" />
            <PageDetailsForm
                className={styles.form}
                page={page}
                cancelFirst
                onSaved={onSaved}
                onCancel={onCancel}
            />
        </dialog>
    );
}
