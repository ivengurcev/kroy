import { useRef, useState } from 'react';
import Button from '../components/ui/Button.jsx';
import Icon from '../components/ui/Icon.jsx';
import styles from './ImageField.module.css';

export default function ImageField({ label, value, onChange }) {
    const [status, setStatus] = useState('idle');
    const inputRef = useRef(null);
    const imageUrl = typeof value === 'string' ? value : '';

    async function uploadImage(event) {
        const file = event.target.files?.[0];

        event.target.value = '';
        if (!file || status === 'uploading') return;

        setStatus('uploading');

        try {
            const form = new FormData();
            form.append('file', file);

            const response = await fetch('/api/media', {
                method: 'POST',
                body: form,
            });

            if (!response.ok) {
                throw new Error(`Не удалось загрузить изображение: ${response.status}`);
            }

            const media = await response.json();

            onChange(media.url);
            setStatus('idle');
        } catch {
            setStatus('error');
        }
    }

    return (
        <div className={styles.field}>
            <span className={styles.label}>{label}</span>
            {imageUrl && <img className={styles.preview} src={imageUrl} alt="" />}
            <input
                className={styles.input}
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={status === 'uploading'}
                onChange={uploadImage}
            />
            <Button
                title={imageUrl ? 'Заменить изображение' : 'Загрузить изображение'}
                disabled={status === 'uploading'}
                onClick={() => inputRef.current?.click()}
            >
                <Icon name={imageUrl ? 'edit' : 'add'} />
                {status === 'uploading'
                    ? 'Загрузка…'
                    : imageUrl
                        ? 'Заменить'
                        : 'Загрузить изображение'}
            </Button>
            <small className={styles.error} role={status === 'error' ? 'alert' : undefined}>
                {status === 'error' && 'Не удалось загрузить изображение.'}
            </small>
        </div>
    );
}
