import { useState } from 'react';
import PageDetailsForm from './PageDetailsForm.jsx';
import Modal from '../ui/Modal.jsx';

export default function PageDetailsDialog({ page, onSaved, onCancel, onDirtyChange, onAppearancePreview }) {
    const [isSubmitting, setIsSubmitting] = useState(false);

    return (
        <Modal title="Настройки страницы" narrow busy={isSubmitting} onClose={onCancel}>
            <PageDetailsForm
                page={page}
                cancelFirst
                handleEscape={false}
                onSubmittingChange={setIsSubmitting}
                onDirtyChange={onDirtyChange}
                onAppearancePreview={onAppearancePreview}
                onSaved={onSaved}
                onCancel={onCancel}
            />
        </Modal>
    );
}
