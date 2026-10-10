import Section from '../../layout/Section'

export default ({title, description = ''}) => {
    return <Section>
        <h1>{title}</h1>
        <div>
            {description}
        </div>
    </Section>
}