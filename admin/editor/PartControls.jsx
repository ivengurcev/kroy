import Button from '../ui/Button.jsx';
import Icon from '../ui/Icon.jsx';
import styles from './PartControls.module.css';
import { useId, useState } from 'react';

export default function PartControls({
    className = '',
    partId,
    isFirst,
    isLast,
    isEditing = false,
    onEdit,
    onClose,
    onMove,
    onRemove,
    notice,
}) {
    const tooltipId = useId();
    const [dismissed, setDismissed] = useState(false);
    return (
        <div className={`${styles.controls} ${className}`} data-editor-control>
            {notice && <span className={styles.notice}
                onMouseEnter={() => setDismissed(false)} onFocus={() => setDismissed(false)}
                onKeyDown={(event) => { if (event.key === 'Escape') setDismissed(true); }}>
                <Button variant="iconCompact" aria-label="Область действия изменений" aria-describedby={tooltipId}
                    onClick={() => setDismissed(false)}>⚠</Button>
                <span id={tooltipId} role="tooltip" data-dismissed={dismissed}>{notice}</span>
            </span>}
            {onEdit && <Button
                variant="iconCompact"
                title={isEditing ? 'Закрыть редактор запчасти' : 'Редактировать свойства запчасти'}
                aria-label={isEditing ? 'Закрыть редактор запчасти' : 'Редактировать свойства запчасти'}
                onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (isEditing) onClose();
                    else onEdit(partId);
                }}
            >
                <Icon name={isEditing ? 'close' : 'edit'} size={18} />
            </Button>}
            {onMove && <><Button
                variant="iconCompact"
                aria-label="Переместить запчасть вверх"
                title="Переместить запчасть вверх"
                disabled={isFirst}
                onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onMove(partId, -1);
                }}
            >
                <Icon name="up" size={18} />
            </Button></>}
            {onRemove && <Button
                variant="iconCompact"
                aria-label="Переместить запчасть вниз"
                title="Переместить запчасть вниз"
                disabled={isLast}
                onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onMove(partId, 1);
                }}
            >
                <Icon name="down" size={18} />
            </Button>}
            <Button
                variant="iconCompact"
                aria-label="Удалить запчасть"
                title="Удалить запчасть"
                onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onRemove(partId);
                }}
            >
                <Icon name="delete" size={18} />
            </Button>
        </div>
    );
}
