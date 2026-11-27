import styles from './ValidatedForm.module.css';

export default function FormError({ children, className = '' }) {
    return <p className={`${styles.formError} ${className}`} role="alert">{children}</p>;
}
