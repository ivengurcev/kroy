import { useState } from 'react';
import styles from './services.module.css';
import Section from '../../runtime/Section.jsx';

function Category({ category }) {
    const [isOpen, setIsOpen] = useState(true);
    const items = category.items;

    return (
        <div className={styles.category}>
            <button
                className={styles.categoryToggle}
                type="button"
                aria-expanded={isOpen}
                onClick={() => setIsOpen((value) => !value)}
            >
                {category?.title}
            </button>

            <div className={`${styles.categoryContent} ${isOpen ? styles.categoryContentOpen : ''}`}>
                <ul className={styles.items}>
                    {items.map((item, index) => (
                        <li className={styles.service} key={`${item?.name ?? ''}-${index}`}>
                            <div>
                                <p className={styles.serviceName}>{item?.name}</p>
                                {item?.note && <p className={styles.note}>{item.note}</p>}
                            </div>
                            {item?.price && <p className={styles.price}>{item.price}</p>}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}

/**
 * @kroy-title Услуги
 * @kroy-category Контент
 * @kroy-contract services
 */
export default function Services({ data }) {
    const { title, eyebrow, categories } = data;

    return (
        <Section className={styles.servicesContainer}>
            <div className={styles.services}>
                <header className={styles.heading}>
                    {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
                    {title && <h2 className={styles.title}>{title}</h2>}
                </header>

                <div className={styles.categories}>
                    {categories.map((category, index) => (
                        <Category category={category} key={`${category?.title ?? ''}-${index}`} />
                    ))}
                </div>
            </div>
        </Section>
    );
}
