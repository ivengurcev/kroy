import styles from './NativeControls.module.css';

export function Input({ className = '', ...props }) {
    return <input {...props} className={`${styles.input} ${className}`} />;
}

export function Textarea({ className = '', ...props }) {
    return <textarea {...props} className={`${styles.input} ${styles.textarea} ${className}`} />;
}

export function Select({ className = '', ...props }) {
    return <select {...props} className={`${styles.input} ${className}`} />;
}

export function Checkbox({ className = '', ...props }) {
    return <input {...props} type="checkbox" className={`${styles.checkbox} ${className}`} />;
}
