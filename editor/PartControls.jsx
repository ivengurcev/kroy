import Button from '../components/ui/Button.jsx';
import Icon from '../components/ui/Icon.jsx';
import styles from './PartControls.module.css';

export default function PartControls({
    className = '',
    partId,
    isFirst,
    isLast,
    onMove,
    onRemove,
}) {
    return (
        <div className={`${styles.controls} ${className}`} data-editor-control>
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
