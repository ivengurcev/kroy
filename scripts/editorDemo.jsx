
import { useState } from 'react';
import { createRoot } from 'react-dom/client';

import Page from '../layout/Page.jsx';
import { parts } from '../generated/parts.mjs';
import metadata from '../generated/parts.json';

const initialContent = [
    {
        part: '@kroy/hero',
        props: {
            title: 'Ветеринарный врач',
            description: 'Забота о ваших питомцах',
        },
    },
    {
        part: '@kroy/contacts',
        props: {
            phone: '+7 999 123-45-67',
            socials: [],
        },
    },
];

function Field({ schema, value, onChange }) {
    const common = {
        value: value ?? '',
        onChange: (event) => onChange(event.target.value),
    };

    switch (schema.type) {
        case 'input':
            return (
                <input
                    {...common}
                    type={schema.validators?.type === 'phone' ? 'tel' : 'text'}
                    maxLength={schema.validators?.maxLength}
                />
            );

        case 'textarea':
            return <textarea {...common} rows={4} />;

        default:
            return (
                <small>
                    Тип «{schema.type}» пока не поддерживается
                </small>
            );
    }
}

function App() {
    const [content, setContent] = useState(initialContent);

    function updateProp(index, name, value) {
        setContent((previous) =>
            previous.map((item, i) =>
                i === index
                    ? {
                          ...item,
                          props: { ...item.props, [name]: value },
                      }
                    : item
            )
        );
    }

    return (
        <main className="editor">
            <div className="panel">
                <h2>Редактор</h2>

                {content.map(({ part, props }, index) => {
                    const fields = metadata[part]?.fields ?? {};

                    return (
                        <section key={index}>
                            <h3>{part}</h3>

                            {Object.entries(fields).map(([name, schema]) => (
                                <label key={name}>
                                    {name}

                                    <Field
                                        schema={schema}
                                        value={props[name]}
                                        onChange={(value) =>
                                            updateProp(index, name, value)
                                        }
                                    />
                                </label>
                            ))}
                        </section>
                    );
                })}
            </div>

            <div className="result">
                <h2>Результат</h2>

                <Page content={content} parts={parts} />

                <h2>Данные страницы</h2>
                <pre>{JSON.stringify(content, null, 2)}</pre>
            </div>
        </main>
    );
}

createRoot(document.getElementById('root')).render(<App />);
