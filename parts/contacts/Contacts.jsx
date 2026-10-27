import Section from '../../layout/Section'



/**
 * @kroy-title Контакты
 * @kroy-category Основное
 *
 * @param {object} props
 * @param {string} props.phone - Телефон
 * @param {{name: string, link: string}[]} props.socials - Социальные сети
 *
 * @kroy phone widget=tel format=ru
 * @kroy socials.name maxLength=30
 * @kroy socials.link widget=url
 */


export default function Contacts({phone='', socials = []}) {
    return <Section>
        <h1>{phone}</h1>
        <ul>
            {socials.map(({name, link}) => <li key={name} ><a href={link}>{name}</a></li>)}
        </ul>
    </Section>
}
