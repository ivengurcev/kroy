import styles from './AdminShell.module.css';
import Card from './ui/Card.jsx';
import SegmentedControl from './ui/SegmentedControl.jsx';

const devices = [
    { icon: 'desktop', label: 'Компьютер' },
    { icon: 'tablet', label: 'Планшет' },
    { icon: 'phone', label: 'Телефон' },
];

export default function EditorFooter() {
    return (
        <Card as="footer" className={styles.footer}>
            <SegmentedControl items={devices} ariaLabel="Размер предпросмотра" />
        </Card>
    );
}
