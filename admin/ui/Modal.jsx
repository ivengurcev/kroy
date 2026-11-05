import { useEffect, useRef, useId } from 'react';
import styles from './Modal.module.css';

export default function Modal({ title, children, actions, onClose, busy = false }) {
    const ref = useRef(null);
    const titleId = useId();
    useEffect(() => { ref.current?.showModal(); }, []);
    return <dialog ref={ref} className={styles.dialog} aria-labelledby={titleId}
        onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
        <div className={styles.layout}>
            <header className={styles.header}><h2 id={titleId}>{title}</h2></header>
            <div className={styles.body}>{children}</div>
            <footer className={styles.actions}>{actions}</footer>
        </div>
    </dialog>;
}
