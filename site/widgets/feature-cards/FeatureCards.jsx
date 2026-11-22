import Section from '../../runtime/Section.jsx';
import Image from '../../components/Image.jsx';
import styles from './featureCards.module.css';

/**
 * @kroy-title Карточки с иконками
 * @kroy-category Контент
 * @kroy-contract cards
 * @param {number} [props.columns=4] - Количество колонок
 * @kroy columns widget=number min=1 max=4
 */
export default function FeatureCards({ data, options = {} }) {
    const { title, headingIcon, cards = [] } = data;
    const numericColumns = Number(options.columns ?? 4);
    const columns = Number.isFinite(numericColumns) ? Math.min(4, Math.max(1, Math.round(numericColumns))) : 4;
    if (!title && !cards.length) return null;

    return (
        <Section className={styles.section}>
            <div className={styles.inner}>
                {title && (
                    <header className={styles.header}>
                        {headingIcon && <Image src={headingIcon} monochrome className={styles.headingIcon} />}
                        <h2 className={styles.title}>{title}</h2>
                    </header>
                )}
                {cards.length > 0 && (
                    <ul className={styles.grid} data-columns={columns} style={{ '--feature-card-columns': columns }}>
                        {cards.map((card, index) => (
                            <li key={index} className={styles.card}>
                                {card.icon && (
                                    <span className={styles.iconCircle}>
                                        <Image src={card.icon} monochrome className={styles.cardIcon} />
                                    </span>
                                )}
                                {card.title && <h3 className={styles.cardTitle}>{card.title}</h3>}
                                {card.description && <p className={styles.description}>{card.description}</p>}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </Section>
    );
}
