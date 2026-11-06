import styles from './Card.module.css';
import ValidatedForm from './ValidatedForm.jsx';

export default function Card({ as: Component = 'div', className = '', children, ...props }) {
    if (Component === 'form') Component = ValidatedForm;
    return <Component className={`${styles.card} ${className}`} {...props}>{children}</Component>;
}
