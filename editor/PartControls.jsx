import Button from '../components/ui/Button.jsx';
import Icon from '../components/ui/Icon.jsx';
import styles from './PartControls.module.css';

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
}) {
    return (
        <div className={`${styles.controls} ${className}`} data-editor-control>
            <Button
                className={styles.editAction}
                variant="compact"
                onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (isEditing) onClose();
                    else onEdit(partId);
                }}
            >
                <Icon name={isEditing ? 'close' : 'edit'} />
                {isEditing ? 'Закрыть' : 'Редактировать'}
            </Button>
            <Button
                variant="compact"
                aria-label="Переместить вверх"
                disabled={isFirst}
                onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onMove(partId, -1);
                }}
            >
                <Icon name="up" />
            </Button>
            <Button
                variant="compact"
                aria-label="Переместить вниз"
                disabled={isLast}
                onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onMove(partId, 1);
                }}
            >
                <Icon name="down" />
            </Button>
            <Button
                variant="compact"
                aria-label="Удалить запчасть"
                onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onRemove(partId);
                }}
            >
                <Icon name="delete" />
            </Button>
        </div>
    );
}
