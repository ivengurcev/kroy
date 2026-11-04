import { forwardRef } from 'react';
import styles from './Button.module.css';

const Button = forwardRef(function Button({ children, className = '', variant = 'secondary', size, ...props }, ref) {
    return (
        <button ref={ref} className={`${styles.button} ${styles[variant]} ${size ? styles[size] : ''} ${className}`} type="button" {...props}>
            {children}
        </button>
    );
});

export default Button;
