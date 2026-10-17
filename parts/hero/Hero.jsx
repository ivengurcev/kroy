import Section from '../../layout/Section'

/**
 * @param {object} props
 * @param {string} props.title - Заголовок
 * @param {string} props.description - Описание
 * 
 * @kroy description widget=textarea
 */

export default ({title, description = ''}) => {
    return <Section>
        <h1>{title}</h1>
        <hr />
        <div>
            {description}
        </div>
    </Section>
}
