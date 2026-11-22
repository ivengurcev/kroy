import Section from '../../runtime/Section.jsx';
import Image from '../../components/Image.jsx';
import styles from './textEditorial.module.css';

/**
 * @kroy-title Журнальный — с фотографией
 * @kroy-category Основное
 * @kroy-contract text
 * @param {'left'|'right'} [props.imageSide=right] - Расположение фотографии
 * @param {'left'|'center'|'right'} [props.imagePosition=center] - Положение изображения в кадре
 * @kroy imageSide optionLabels=left:Слева,right:Справа
 * @kroy imagePosition optionLabels=left:Слева,center:Центр,right:Справа
 */
export default function TextEditorial({ data, options = {} }) {
    const { title, lead, paragraphs = [], photo, photoAlt = '' } = data;
    const hasCopy = Boolean(lead || paragraphs.length);
    const hasText = Boolean(title || hasCopy);
    if (!hasText && !photo) return null;
    const withPhoto = Boolean(photo && hasText);
    const imagePosition = options.imagePosition === 'left' ? styles.positionLeft
        : options.imagePosition === 'right' ? styles.positionRight : '';

    return (
        <Section className={styles.section}>
            <div className={`${styles.inner} ${withPhoto ? styles.withPhoto : ''} ${options.imageSide === 'left' ? styles.imageLeft : ''}`}>
                {title && <h2 className={styles.title}>{title}</h2>}
                {photo && (
                    <div className={`${styles.photoArea} ${imagePosition}`}>
                        <Image src={photo} alt={photoAlt} className={styles.photo} />
                    </div>
                )}
                {hasCopy && (
                    <div className={styles.copy}>
                        {lead && <p className={styles.lead}>{lead}</p>}
                        {paragraphs.length > 0 && (
                            <div className={styles.text}>
                                {paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </Section>
    );
}
