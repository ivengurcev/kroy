import Map from '../../components/site/Map.jsx';
import styles from './contacts.module.css';

function telephoneHref(phone) {
    const value = typeof phone === 'string' ? phone.trim() : '';
    const target = value.replace(/[^+\d]/g, '');
    return /\d/.test(target) ? `tel:${target}` : null;
}

/**
 * @kroy-title Контакты
 * @kroy-category Основное
 *
 * @param {object} props
 * @param {string} props.title - Заголовок секции
 * @param {number} props.zoom - Масштаб карты
 * @param {string} props.markerText - Подпись маркера
 *
 * @kroy title widget=textarea
 * @kroy zoom widget=number
 * @kroy markerText widget=input
 */
export default function Contacts({
    title = '',
    address = '',
    hours = '',
    phone = '',
    latitude = null,
    longitude = null,
    zoom = 14,
    markerText = '',
}) {
    const href = telephoneHref(phone);
    const hasCoordinates = Number.isFinite(Number(latitude))
        && Number.isFinite(Number(longitude));

    return (
        <section className={styles.contactsContainer}>
            <div className={styles.contacts}>
                <div className={styles.content}>
                    {title && <h2 className={styles.title}>{title}</h2>}
                    <dl className={styles.details}>
                        {address && <div><dt>Адрес</dt><dd>{address}</dd></div>}
                        {hours && <div><dt>Режим работы</dt><dd>{hours}</dd></div>}
                        {phone && <div><dt>Телефон</dt><dd>{href ? <a href={href}>{phone}</a> : phone}</dd></div>}
                    </dl>
                </div>
                {hasCoordinates && <Map
                        className={styles.map}
                        latitude={latitude}
                        longitude={longitude}
                        zoom={zoom}
                        markerText={markerText}
                    />}
            </div>
        </section>
    );
}
