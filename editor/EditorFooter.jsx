import styles from './EditorFooter.module.css';
import Card from '../components/ui/Card.jsx';
import SegmentedControl from '../components/ui/SegmentedControl.jsx';

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
