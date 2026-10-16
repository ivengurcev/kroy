import Section from '../../layout/Section'
import { useState } from 'react';

/**
 * @param {object} props
 * @param {string} props.title - Заголовок
 * @param {string} props.description - Описание
 * 
 * @kroy description widget=textarea
 */

export default ({title, description = ''}) => {
    const [count, setCount] = useState(0);

    return <Section>
        <h1>{title}</h1>
        <div><button onClick={() => setCount(pState => pState + 1)}>clickme {count}</button></div>
        <div>
            {description}
        </div>
    </Section>
}