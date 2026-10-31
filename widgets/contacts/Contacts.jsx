import Map from '../../components/site/Map.jsx';
import Section from '../../layout/Section.jsx';
import styles from './contacts.module.css';

/**
 * @kroy-title Контакты
 * @kroy-category Основное
 * @kroy-contract contacts
 */
export default function Contacts({ data }) {
    const { title, address, hours, phone, latitude, longitude, zoom, markerText, phoneHref: href, hasCoordinates } = data;

    return (
        <Section className={styles.contactsContainer}>
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
        </Section>
    );
}
