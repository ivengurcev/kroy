import Section from '../../runtime/Section.jsx';
import CardCarousel from '../../components/CardCarousel.jsx';
import MaterialCard from '../material-cards/MaterialCard.jsx';
import styles from './materialCarousel.module.css';

/**
 * @kroy-title Карусель материалов
 * @kroy-category Материалы
 * @kroy-contract materials-list
 */
export default function MaterialCarousel({ data = [] }) {
    return (
        <Section className={styles.section}>
            <div className={styles.inner}>
                {data.length
                    ? <CardCarousel label="Материалы">
                        {data.map((material) => <MaterialCard key={material.slug} material={material} />)}
                    </CardCarousel>
                    : <p className={styles.empty} role="status">Опубликованных материалов пока нет.</p>}
            </div>
        </Section>
    );
}
