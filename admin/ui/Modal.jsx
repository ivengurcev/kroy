import { useEffect, useRef, useId } from 'react';
import styles from './Modal.module.css';

export default function Modal({ title, children, actions, onClose, busy = false, narrow = false, closeOnBackdrop = false }) {
    const ref = useRef(null);
    const titleId = useId();
    useEffect(() => {
        const dialog = ref.current;
        dialog.showModal();
        return () => dialog.close();
    }, []);
    return <dialog ref={ref} className={`${styles.dialog}${narrow ? ` ${styles.narrow}` : ''}`} aria-labelledby={titleId}
        onClick={closeOnBackdrop ? (event) => { if (!busy && event.target === event.currentTarget) onClose(); } : undefined}
        onCancel={(event) => { if (event.target !== event.currentTarget) return; event.preventDefault(); if (!busy) onClose(); }}>
        <div className={styles.layout}>
            <header className={styles.header}><h2 id={titleId}>{title}</h2></header>
            <div className={styles.body}>{children}</div>
            {actions && <footer className={styles.actions}>{actions}</footer>}
        </div>
    </dialog>;
}
