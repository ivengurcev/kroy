import styles from './SegmentedControl.module.css';
import Icon from './Icon.jsx';

export default function SegmentedControl({ items, activeIndex = 0, ariaLabel }) {
    return (
        <div className={styles.control} data-active={activeIndex} role="group" aria-label={ariaLabel}>
            {items.map((item, index) => (
                <button className={index === activeIndex ? styles.active : ''} type="button" title={item.label} disabled key={item.label}>
                    <Icon name={item.icon} size={20} />
                    <span>{item.label}</span>
                </button>
            ))}
        </div>
    );
}
