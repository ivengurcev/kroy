import { useState } from 'react';
import styles from './services.module.css';
import Section from '../../layout/Section.jsx';

function Category({ category }) {
    const [isOpen, setIsOpen] = useState(true);
    const items = Array.isArray(category?.items) ? category.items : [];

    return (
        <details
            className={styles.category}
            open={isOpen}
            onToggle={(event) => setIsOpen(event.currentTarget.open)}
        >
            <summary>{category?.title}</summary>

            <div className={styles.categoryContent}>
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
        </details>
    );
}

/**
 * @kroy-title Услуги
 * @kroy-category Контент
 *
 * @param {object} props
 * @param {string} props.title - Заголовок секции
 * @param {string} props.eyebrow - Надпись над заголовком
 * @param {{title: string, items: {name: string, price: string, note: string}[]}[]} props.categories - Направления
 *
 * @kroy title widget=textarea
 * @kroy eyebrow widget=input
 * @kroy categories.title label=Название
 * @kroy categories.items label=Услуги
 * @kroy categories.items.name label=Услуга
 * @kroy categories.items.price label=Цена
 * @kroy categories.items.note label=Примечание
 */
export default function Services({
    title = '',
    eyebrow = '',
    categories = [],
}) {
    const visibleCategories = Array.isArray(categories) ? categories : [];

    return (
        <Section className={styles.servicesContainer}>
            <div className={styles.services}>
                <header className={styles.heading}>
                    {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
                    {title && <h2 className={styles.title}>{title}</h2>}
                </header>

                <div className={styles.categories}>
                    {visibleCategories.map((category, index) => (
                        <Category category={category} key={`${category?.title ?? ''}-${index}`} />
                    ))}
                </div>
            </div>
        </Section>
    );
}
