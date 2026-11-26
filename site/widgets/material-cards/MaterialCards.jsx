import Section from '../../runtime/Section.jsx';
import MaterialCard from './MaterialCard.jsx';
import styles from './materialCards.module.css';

/**
 * @kroy-title Карточки материалов
 * @kroy-category Материалы
 * @kroy-contract materials-list
 */
export default function MaterialCards({ data }) {
    return (
        <Section className={styles.section}>
            <div className={styles.inner}>
                {data.length ? <div className={styles.grid}>
                    {data.map((material) => <MaterialCard key={material.slug} material={material} />)}
                </div> : <p className={styles.empty} role="status">Опубликованных материалов пока нет.</p>}
            </div>
        </Section>
    );
}
