import { normalizeHref } from '../../../shared/safeHref.mjs';
import styles from './SiteFooter.module.css';

function Links({ links, label }) {
    const safeLinks = (links ?? []).filter((link) => link.label && normalizeHref(link.href));
    if (!safeLinks.length) return null;
    return <nav className={styles.section} aria-label={label}>
        <h2 className={styles.heading}>{label}</h2>
        <ul className={styles.links}>{safeLinks.map(({ href, label }, index) => <li key={`${href}-${index}`}><a href={href}>{label}</a></li>)}</ul>
    </nav>;
}

/** @kroy-contract footer */
export default function Footer({ data }) {
    const { siteName = '', description = '', navigation = [], documents = [], legal = {},
        year, contacts, phoneHref, email, socials } = data;
    const hasContacts = contacts.phone || email || contacts.address || socials.length > 0;

    return <footer className={styles.footer} aria-label="Подвал сайта">
        <div className={styles.inner}>
            <div className={styles.sections}>
                {(siteName || description) && <div>
                    {siteName && <p className={styles.name}>{siteName}</p>}
                    {description && <p className={styles.description}>{description}</p>}
                </div>}
                <Links links={navigation} label="Навигация" />
                {hasContacts && <div className={styles.section}>
                    <h2 className={styles.heading}>Контакты</h2>
                    <address className={styles.contacts}>
                        {contacts.phone && <p>{phoneHref ? <a href={phoneHref}>{contacts.phone}</a> : contacts.phone}</p>}
                        {email && <p><a href={`mailto:${email}`}>{email}</a></p>}
                        {contacts.address && <p className={styles.address}>{contacts.address}</p>}
                        {socials.length > 0 && <ul className={styles.links}>{socials.map(({ name, href }, index) => <li key={`${href}-${index}`}><a href={href}>{name}</a></li>)}</ul>}
                    </address>
                </div>}
                <Links links={documents} label="Документы" />
            </div>
            <div className={styles.bottom}>
                <div className={styles.details}>
                    <p>© {year}{siteName || legal.name ? ` ${siteName || legal.name}` : ''}</p>
                    {legal.name && <p>{legal.name}</p>}
                    {legal.inn && <p>ИНН {legal.inn}</p>}
                    {legal.registrationNumber && <p>ОГРН/ОГРНИП {legal.registrationNumber}</p>}
                </div>
                <a className={styles.branding} href="https://oysite.ru">Создано на Oysite</a>
            </div>
        </div>
    </footer>;
}
