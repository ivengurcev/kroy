import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Button from '../components/ui/Button.jsx';
import Icon from '../components/ui/Icon.jsx';
import styles from './ImageField.module.css';

const DEFAULT_MAX_WIDTH = 1600;
const CROP_QUALITY = 0.82;

function parseAspectRatio(value, fallback) {
    const match = typeof value === 'string' && value.match(/^(\d+):(\d+)$/);
    if (!match) return fallback;

    const width = Number(match[1]);
    const height = Number(match[2]);
    return width > 0 && height > 0 ? width / height : fallback;
}

function parseMaxWidth(value) {
    return Number.isInteger(value) && value > 0 ? value : DEFAULT_MAX_WIDTH;
}

function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
}

export default function ImageField({ label, value, aspectRatio, maxWidth, onChange }) {
    const [status, setStatus] = useState('idle');
    const [crop, setCrop] = useState(null);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [stageSize, setStageSize] = useState({ width: 520, height: 320 });
    const inputRef = useRef(null);
    const dialogRef = useRef(null);
    const stageRef = useRef(null);
    const imageRef = useRef(null);
    const dragRef = useRef(null);
    const imageUrl = typeof value === 'string' ? value : '';
    const outputMaxWidth = parseMaxWidth(maxWidth);

    useEffect(() => {
        if (!crop || !dialogRef.current) return undefined;

        dialogRef.current.showModal();
        return undefined;
    }, [crop]);

    useLayoutEffect(() => {
        if (!crop || !stageRef.current) return undefined;

        const updateSize = () => {
            const { width, height } = stageRef.current.getBoundingClientRect();
            setStageSize({ width, height });
        };

        updateSize();
        const observer = new ResizeObserver(updateSize);
        observer.observe(stageRef.current);
        return () => observer.disconnect();
    }, [crop]);

    function closeCrop() {
        if (dialogRef.current?.open) dialogRef.current.close();
        if (crop?.url) URL.revokeObjectURL(crop.url);
        crop?.bitmap?.close();
        setCrop(null);
        setZoom(1);
        setPan({ x: 0, y: 0 });
        setStatus('idle');
    }

    function handleCancel(event) {
        event.preventDefault();
        if (status !== 'uploading') closeCrop();
    }

    function selectImage(event) {
        const file = event.target.files?.[0];
        event.target.value = '';

        if (!file || status === 'uploading') return;

        const url = URL.createObjectURL(file);
        const image = new Image();
        image.onload = async () => {
            let bitmap;

            try {
                bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
            } catch {
                bitmap = undefined;
            }

            const width = bitmap?.width ?? image.naturalWidth;
            const height = bitmap?.height ?? image.naturalHeight;
            const ratio = parseAspectRatio(aspectRatio, width / height);
            setZoom(1);
            setPan({ x: 0, y: 0 });
            setStatus('idle');
            setCrop({ url, bitmap, width, height, ratio });
        };
        image.onerror = () => {
            URL.revokeObjectURL(url);
            setStatus('error');
        };
        image.src = url;
    }

    function displayScale() {
        if (!crop || !stageSize.width || !stageSize.height) return 1;
        return Math.max(stageSize.width / crop.width, stageSize.height / crop.height) * zoom;
    }

    function panBounds(nextZoom = zoom) {
        if (!crop || !stageSize.width || !stageSize.height) return { x: 0, y: 0 };
        const scale = Math.max(stageSize.width / crop.width, stageSize.height / crop.height) * nextZoom;
        return {
            x: Math.max(0, (crop.width * scale - stageSize.width) / 2),
            y: Math.max(0, (crop.height * scale - stageSize.height) / 2),
        };
    }

    function setZoomValue(event) {
        const nextZoom = Number(event.target.value);
        const bounds = panBounds(nextZoom);
        setZoom(nextZoom);
        setPan((current) => ({
            x: clamp(current.x, -bounds.x, bounds.x),
            y: clamp(current.y, -bounds.y, bounds.y),
        }));
    }

    function startDrag(event) {
        if (status === 'uploading') return;
        event.currentTarget.setPointerCapture(event.pointerId);
        dragRef.current = { x: event.clientX, y: event.clientY, pan };
    }

    function moveDrag(event) {
        if (!dragRef.current) return;
        const bounds = panBounds();
        const next = {
            x: dragRef.current.pan.x + event.clientX - dragRef.current.x,
            y: dragRef.current.pan.y + event.clientY - dragRef.current.y,
        };
        setPan({
            x: clamp(next.x, -bounds.x, bounds.x),
            y: clamp(next.y, -bounds.y, bounds.y),
        });
    }

    function stopDrag() {
        dragRef.current = null;
    }

    async function cropImage() {
        const image = crop?.bitmap || imageRef.current;
        if (!crop || !image || !stageSize.width || !stageSize.height) {
            throw new Error('Изображение не готово к кадрированию.');
        }

        const scale = displayScale();
        const sourceWidth = stageSize.width / scale;
        const sourceHeight = stageSize.height / scale;
        const centerX = crop.width / 2 - pan.x / scale;
        const centerY = crop.height / 2 - pan.y / scale;
        const sourceX = clamp(centerX - sourceWidth / 2, 0, crop.width - sourceWidth);
        const sourceY = clamp(centerY - sourceHeight / 2, 0, crop.height - sourceHeight);
        const width = Math.max(1, Math.min(outputMaxWidth, Math.round(sourceWidth)));
        const height = Math.max(1, Math.round(width / crop.ratio));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext('2d');
        context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);

        return new Promise((resolve, reject) => {
            canvas.toBlob((blob) => blob
                ? resolve(blob)
                : reject(new Error('Не удалось обработать изображение.')), 'image/webp', CROP_QUALITY);
        });
    }

    async function uploadImage() {
        if (!crop || status === 'uploading') return;
        setStatus('uploading');

        try {
            const blob = await cropImage();
            const form = new FormData();
            form.append('file', blob, 'image.webp');
            form.append('maxWidth', String(outputMaxWidth));

            const response = await fetch('/api/media', {
                method: 'POST',
                body: form,
            });

            if (!response.ok) {
                throw new Error(`Не удалось загрузить изображение: ${response.status}`);
            }

            const media = await response.json();
            onChange(media.url);
            closeCrop();
        } catch {
            setStatus('error');
        }
    }

    const scale = crop ? displayScale() : 1;

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
                onChange={selectImage}
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
                {status === 'error' && 'Не удалось обработать или загрузить изображение.'}
            </small>

            {crop && (
                <dialog className={styles.dialog} ref={dialogRef} onCancel={handleCancel}>
                    <div className={styles.dialogHeader}>
                        <h2>Кадрирование изображения</h2>
                        <Button title="Отменить" variant="compact" disabled={status === 'uploading'} onClick={closeCrop}>
                            <Icon name="close" />
                        </Button>
                    </div>
                    <div
                        className={styles.cropStage}
                        ref={stageRef}
                        style={{ aspectRatio: crop.ratio }}
                        onPointerDown={startDrag}
                        onPointerMove={moveDrag}
                        onPointerUp={stopDrag}
                        onPointerCancel={stopDrag}
                    >
                        <img
                            ref={imageRef}
                            className={styles.cropImage}
                            src={crop.url}
                            alt=""
                            draggable="false"
                            style={{
                                width: crop.width,
                                height: crop.height,
                                transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${scale})`,
                            }}
                        />
                    </div>
                    <label className={styles.zoom}>
                        Масштаб
                        <input type="range" min="1" max="3" step="0.01" value={zoom} onChange={setZoomValue} disabled={status === 'uploading'} />
                    </label>
                    <div className={styles.dialogActions}>
                        <Button variant="secondary" disabled={status === 'uploading'} onClick={closeCrop}>Отмена</Button>
                        <Button disabled={status === 'uploading'} onClick={uploadImage}>
                            {status === 'uploading' ? 'Обработка…' : 'Сохранить изображение'}
                        </Button>
                    </div>
                </dialog>
            )}
        </div>
    );
}
