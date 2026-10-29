import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import styles from './reviews.module.css';

const MAX_WIDTH = 800;

function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
}

export default function ReviewForm({ open, onClose }) {
    const titleId = useId();
    const [status, setStatus] = useState('idle');
    const [photo, setPhoto] = useState(null);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
    const dialogRef = useRef(null);
    const fileRef = useRef(null);
    const stageRef = useRef(null);
    const imageRef = useRef(null);
    const dragRef = useRef(null);
    const selectionRef = useRef(0);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;
        if (open && !dialog.open) dialog.showModal();
        if (!open && dialog.open) dialog.close();
    }, [open]);

    useEffect(() => () => {
        if (photo?.url) URL.revokeObjectURL(photo.url);
        photo?.bitmap?.close();
    }, [photo]);

    useLayoutEffect(() => {
        if (!photo || !stageRef.current) return undefined;
        const updateSize = () => {
            const { width, height } = stageRef.current.getBoundingClientRect();
            setStageSize({ width, height });
        };
        updateSize();
        const observer = new ResizeObserver(updateSize);
        observer.observe(stageRef.current);
        return () => observer.disconnect();
    }, [photo]);

    function reset() {
        selectionRef.current += 1;
        setStatus('idle');
        setPhoto(null);
        setZoom(1);
        setPan({ x: 0, y: 0 });
        setStageSize({ width: 0, height: 0 });
    }

    function close() {
        if (status === 'submitting') return;
        dialogRef.current?.close();
    }

    function handleClose() {
        reset();
        onClose();
    }

    function selectPhoto(event) {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file || status === 'submitting' || status === 'photo-loading') return;

        const selection = ++selectionRef.current;
        setStatus('photo-loading');
        const url = URL.createObjectURL(file);
        const image = new Image();
        image.onload = async () => {
            let bitmap;
            try {
                bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
            } catch {
                bitmap = undefined;
            }
            if (selection !== selectionRef.current) {
                URL.revokeObjectURL(url);
                bitmap?.close();
                return;
            }
            setPhoto({
                url,
                bitmap,
                width: bitmap?.width ?? image.naturalWidth,
                height: bitmap?.height ?? image.naturalHeight,
            });
            setZoom(1);
            setPan({ x: 0, y: 0 });
            setStatus('idle');
        };
        image.onerror = () => {
            URL.revokeObjectURL(url);
            if (selection !== selectionRef.current) return;
            setStatus('photo-error');
        };
        image.src = url;
    }

    function removePhoto() {
        selectionRef.current += 1;
        setPhoto(null);
        setStatus('idle');
    }

    function displayScale(nextZoom = zoom) {
        if (!photo || !stageSize.width || !stageSize.height) return 1;
        return Math.max(stageSize.width / photo.width, stageSize.height / photo.height) * nextZoom;
    }

    function panBounds(nextZoom = zoom) {
        if (!photo || !stageSize.width || !stageSize.height) return { x: 0, y: 0 };
        const scale = displayScale(nextZoom);
        return {
            x: Math.max(0, (photo.width * scale - stageSize.width) / 2),
            y: Math.max(0, (photo.height * scale - stageSize.height) / 2),
        };
    }

    function changeZoom(event) {
        const nextZoom = Number(event.target.value);
        const bounds = panBounds(nextZoom);
        setZoom(nextZoom);
        setPan((current) => ({
            x: clamp(current.x, -bounds.x, bounds.x),
            y: clamp(current.y, -bounds.y, bounds.y),
        }));
    }

    function startDrag(event) {
        if (status === 'submitting') return;
        event.currentTarget.setPointerCapture(event.pointerId);
        dragRef.current = { x: event.clientX, y: event.clientY, pan };
    }

    function moveDrag(event) {
        if (!dragRef.current) return;
        const bounds = panBounds();
        setPan({
            x: clamp(dragRef.current.pan.x + event.clientX - dragRef.current.x, -bounds.x, bounds.x),
            y: clamp(dragRef.current.pan.y + event.clientY - dragRef.current.y, -bounds.y, bounds.y),
        });
    }

    function stopDrag() {
        dragRef.current = null;
    }

    function moveWithKeyboard(event) {
        const direction = {
            ArrowLeft: [12, 0],
            ArrowRight: [-12, 0],
            ArrowUp: [0, 12],
            ArrowDown: [0, -12],
        }[event.key];
        if (!direction || status === 'submitting') return;
        event.preventDefault();
        const bounds = panBounds();
        setPan((current) => ({
            x: clamp(current.x + direction[0], -bounds.x, bounds.x),
            y: clamp(current.y + direction[1], -bounds.y, bounds.y),
        }));
    }

    async function cropPhoto() {
        const image = photo?.bitmap || imageRef.current;
        if (!photo || !image || !stageSize.width || !stageSize.height) throw new Error('Photo is not ready');
        const scale = displayScale();
        const sourceSize = stageSize.width / scale;
        const centerX = photo.width / 2 - pan.x / scale;
        const centerY = photo.height / 2 - pan.y / scale;
        const sourceX = clamp(centerX - sourceSize / 2, 0, photo.width - sourceSize);
        const sourceY = clamp(centerY - sourceSize / 2, 0, photo.height - sourceSize);
        const size = Math.max(1, Math.min(MAX_WIDTH, Math.round(sourceSize)));
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        canvas.getContext('2d').drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size);
        return new Promise((resolve, reject) => canvas.toBlob(
            (blob) => blob ? resolve(blob) : reject(new Error('Photo processing failed')),
            'image/webp',
            0.82,
        ));
    }

    async function submit(event) {
        event.preventDefault();
        if (status === 'submitting' || status === 'photo-loading') return;
        setStatus('submitting');

        try {
            const form = new FormData(event.currentTarget);
            if (photo) form.set('photo', await cropPhoto(), 'review.webp');
            const response = await fetch('/api/reviews', { method: 'POST', body: form });
            if (!response.ok) throw new Error('Submit failed');
            setStatus('success');
        } catch {
            setStatus('error');
        }
    }

    return <dialog className={styles.reviewDialog} ref={dialogRef} aria-labelledby={titleId} onClose={handleClose} onCancel={(event) => { event.preventDefault(); close(); }} onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
        {status === 'success' ? <div className={styles.successMessage} role="status"><h2 id={titleId}>Спасибо за отзыв</h2><p>Отзыв отправлен на модерацию.</p><button className={styles.formPrimaryButton} type="button" onClick={close}>Закрыть</button></div> : <form className={styles.reviewForm} onSubmit={submit}>
            <div className={styles.formHeader}><div><h2 id={titleId}>Оставить отзыв</h2><p>Отзыв появится на сайте после проверки.</p></div><button className={styles.closeButton} type="button" aria-label="Закрыть форму" disabled={status === 'submitting'} onClick={close}>×</button></div>
            <label className={styles.formField}>Имя автора<input name="authorName" required maxLength="200" autoComplete="name" autoFocus /></label>
            <label className={styles.formField}>Дополнительная подпись<input name="authorSubtitle" maxLength="300" /></label>
            <label className={styles.formField}>Текст отзыва<textarea name="text" required maxLength="5000" rows="5" /></label>
            <label className={styles.honeypot} aria-hidden="true">Сайт<input name="website" tabIndex="-1" autoComplete="off" /></label>
            <div className={styles.photoField}><span>Фотография</span><input className={styles.fileInput} ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" disabled={status === 'submitting' || status === 'photo-loading'} onChange={selectPhoto} /><div className={styles.photoActions}><button className={styles.formSecondaryButton} type="button" disabled={status === 'submitting' || status === 'photo-loading'} onClick={() => fileRef.current?.click()}>{status === 'photo-loading' ? 'Подготовка…' : photo ? 'Заменить фотографию' : 'Выбрать фотографию'}</button>{photo && <button className={styles.formTextButton} type="button" disabled={status === 'submitting' || status === 'photo-loading'} onClick={removePhoto}>Удалить</button>}</div></div>
            {photo && <div className={styles.cropArea}><div className={styles.cropStage} ref={stageRef} tabIndex="0" aria-label="Положение фотографии. Используйте стрелки для перемещения" onKeyDown={moveWithKeyboard} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={stopDrag} onPointerCancel={stopDrag}><img className={styles.cropImage} ref={imageRef} src={photo.url} alt="" draggable="false" style={{ width: photo.width, height: photo.height, transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${displayScale()})` }} /></div><label className={styles.zoomField}>Масштаб<input type="range" min="1" max="3" step="0.01" value={zoom} disabled={status === 'submitting'} onChange={changeZoom} /></label></div>}
            {(status === 'error' || status === 'photo-error') && <p className={styles.formError} role="alert">{status === 'photo-error' ? 'Не удалось открыть фотографию.' : 'Не удалось отправить отзыв. Попробуйте ещё раз.'}</p>}
            <div className={styles.formActions}><button className={styles.formSecondaryButton} type="button" disabled={status === 'submitting'} onClick={close}>Отмена</button><button className={styles.formPrimaryButton} type="submit" disabled={status === 'submitting' || status === 'photo-loading'}>{status === 'submitting' ? 'Отправка…' : 'Отправить отзыв'}</button></div>
        </form>}
    </dialog>;
}
