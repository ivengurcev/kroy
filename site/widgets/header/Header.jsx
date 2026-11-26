import styles from './header.module.css';

/** @kroy-contract header */
export default function Header({ data }) {
    return <header className={styles.header}>
        <a href="/">{data.title}</a>
        {!!data.navigation.length && <nav aria-label="Навигация сайта">
            {data.navigation.map(({ href, label }, index) => <a key={`${href}-${index}`} href={href}>{label}</a>)}
        </nav>}
    </header>;
}
