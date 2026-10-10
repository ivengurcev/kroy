import Section from '../../layout/Section'

export default ({phone='', socials = []}) => {
    return <Section>
        <h1>{phone}</h1>
        <ul>
            {socials.map(({name, link}) => <li key={name} ><a href={link}>{name}</a></li>)}
        </ul>
    </Section>
}