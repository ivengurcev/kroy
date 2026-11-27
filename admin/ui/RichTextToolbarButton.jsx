import { forwardRef } from 'react';
import Button from './Button.jsx';
import Icon from './Icon.jsx';
import styles from './RichTextEditor.module.css';

const RichTextToolbarButton = forwardRef(function RichTextToolbarButton({ label, icon, pressed, ...props }, ref) {
    return <Button ref={ref} variant="listIcon" className={styles.toolbarButton}
        title={label} aria-label={label} aria-pressed={pressed}
        onMouseDown={(event) => event.preventDefault()} {...props}>
        <Icon name={icon} size={16} />
    </Button>;
});

export default RichTextToolbarButton;
