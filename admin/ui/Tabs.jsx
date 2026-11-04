import styles from './Tabs.module.css';

export default function Tabs({ items, activeIndex = 0, className = '', ariaLabel, onSelect }) {
    return (
        <nav className={`${styles.tabs} ${className}`} aria-label={ariaLabel}>
            {items.map((item, index) => (
                <button className={index === activeIndex ? styles.active : ''} type="button" title={item.label} disabled={item.disabled} key={item.id ?? item.label} onClick={() => onSelect?.(index, item)}>
                    {item.icon && <b>{item.icon}</b>}
                    <span>{item.label}</span>
                </button>
            ))}
        </nav>
    );
}
