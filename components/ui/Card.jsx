import styles from './Card.module.css';

export default function Card({ as: Component = 'div', className = '', children, ...props }) {
    return <Component className={`${styles.card} ${className}`} {...props}>{children}</Component>;
}
