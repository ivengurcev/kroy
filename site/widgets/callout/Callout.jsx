import Section from '../../runtime/Section.jsx';
import Image from '../../components/Image.jsx';
import styles from './callout.module.css';

/**
 * @kroy-title Акцентный блок
 * @kroy-category Контент
 * @kroy-contract callout
 */
export default function Callout({ data = {} }) {
    const { title, paragraphs = [], icon } = data;
    if (!title && !paragraphs.length) return null;

    return (
        <Section className={styles.section}>
            <div className={styles.inner}>
                <div className={`${styles.panel} ${icon ? styles.withIcon : ''}`}>
                    {icon && <span className={styles.iconCircle}>
                        <Image src={icon} monochrome alt="" className={styles.icon} />
                    </span>}
                    <div className={styles.copy}>
                        {title && <h2 className={styles.title}>{title}</h2>}
                        {paragraphs.length > 0 && <div className={styles.text}>
                            {paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
                        </div>}
                    </div>
                </div>
            </div>
        </Section>
    );
}
