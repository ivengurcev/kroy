import styles from './SegmentedControl.module.css';

export default function SegmentedControl({ items, activeIndex = 0, ariaLabel }) {
    return (
        <div className={styles.control} data-active={activeIndex} role="group" aria-label={ariaLabel}>
            {items.map((item, index) => (
                <button className={index === activeIndex ? styles.active : ''} type="button" disabled key={item.label}>
                    <span className={`${styles.icon} ${styles[item.icon]}`} aria-hidden="true" />
                    <span>{item.label}</span>
                </button>
            ))}
        </div>
    );
}
