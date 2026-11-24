import Image from '../../components/Image.jsx';
import styles from './cta.module.css';

/**
 * @kroy-title Кнопка действия
 * @kroy-category Основное
 * @kroy-contract cta
 */
export default function Cta({ data = {} }) {
    const { title, subtitle, price, icon, href } = data;
    if (!title && !subtitle && !price) return null;
    const Panel = href ? 'a' : 'div';

    return (
        <section className={styles.section}>
            <div className={styles.inner}>
                <Panel className={styles.panel} href={href || undefined} data-native-navigation={href ? '' : undefined}>
                    {icon && <Image src={icon} monochrome alt="" className={styles.icon} />}
                    {(title || subtitle) && <span className={styles.copy}>
                        {title && <span className={styles.title}>{title}</span>}
                        {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
                    </span>}
                    {price && <span className={styles.price}>{price}</span>}
                </Panel>
            </div>
        </section>
    );
}
