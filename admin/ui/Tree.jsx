import Button from './Button.jsx';
import Icon from './Icon.jsx';
import styles from './Tree.module.css';

export default function Tree({ children, ...props }) {
    return <ul className={styles.items} {...props}>{children}</ul>;
}

export function TreeGroup({ label, actions, nested = false, children }) {
    const group = <fieldset className={styles.listField} data-nested={nested || undefined}>
        <legend className={styles.listHeader}><span>{label}</span>{actions}</legend>
        {children}
    </fieldset>;
    return nested ? <div className={styles.childGroup}>{group}</div> : group;
}

export function TreeChildren({ expanded = true, children, id }) {
    return <div className={styles.children} id={id} hidden={!expanded}>{children}</div>;
}

export function TreeEmpty({ children }) {
    return <p className={styles.empty}>{children}</p>;
}

export function TreeItem({ label, title, href, onClick, folder = false, expanded = true, onToggle, toggleLabel,
    controlsId, count, actions, children, selected = false, muted = false, icon = folder ? 'folder' : 'file', description, descriptionId }) {
    const Summary = href ? 'a' : onClick ? 'button' : 'span';
    return <li className={styles.listItem} data-parent={folder || undefined}>
        <div className={styles.itemHeader} data-selected={selected || undefined}>
            {onToggle && <Button variant="listIcon" aria-expanded={expanded} aria-controls={controlsId}
                title={toggleLabel} aria-label={toggleLabel} onClick={onToggle}>
                <Icon name="chevronRight" size={16} className={expanded ? styles.expanded : ''} />
            </Button>}
            <Summary className={`${styles.summary} ${muted ? styles.muted : ''}`} href={href}
                type={onClick && !href ? 'button' : undefined} onClick={onClick} title={title}
                aria-describedby={description ? descriptionId : undefined}>
                {description ? <span title={description} className={styles.nodeIcon}><Icon name={icon} size={16} /></span>
                    : <Icon name={icon} size={16} className={styles.nodeIcon} />}
                {description && <span id={descriptionId} className={styles.description}>{description}</span>}
                <span className={styles.nodeName}>{label}</span>
                {count !== undefined && <small aria-label={`Вложенных элементов: ${count}`}>{count}</small>}
            </Summary>
            {actions && <div className={styles.actions}>{actions}</div>}
        </div>
        {children}
    </li>;
}
