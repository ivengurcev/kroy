import { useEffect, useRef, useState } from 'react';
import PageDetailsForm from './PageDetailsForm.jsx';
import Tabs from '../ui/Tabs.jsx';
import styles from './PageDetailsDialog.module.css';

const tabs = [
    { label: 'Основное' },
    { label: 'SEO', disabled: true },
    { label: 'Дополнительно', disabled: true },
];

export default function PageDetailsDialog({ page, onSaved, onCancel }) {
    const dialogRef = useRef(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        dialogRef.current?.showModal();
    }, []);

    function handleCancel(event) {
        event.preventDefault();
        if (!isSubmitting) onCancel();
    }

    return (
        <dialog
            className={styles.dialog}
            ref={dialogRef}
            aria-labelledby="page-details-title"
            onCancel={handleCancel}
        >
            <h2 id="page-details-title">Настройки страницы</h2>
            <Tabs className={styles.tabs} items={tabs} ariaLabel="Разделы настроек страницы" />
            <PageDetailsForm
                className={styles.form}
                page={page}
                cancelFirst
                handleEscape={false}
                onSubmittingChange={setIsSubmitting}
                onSaved={onSaved}
                onCancel={onCancel}
            />
        </dialog>
    );
}
