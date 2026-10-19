import styles from './Button.module.css';

export default function Button({ children, className = '', variant = 'secondary', ...props }) {
    return (
        <button className={`${styles.button} ${styles[variant]} ${className}`} type="button" {...props}>
            {children}
        </button>
    );
}
