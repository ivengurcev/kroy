
import { useState } from 'react';

import Page from '../layout/Page.jsx';
import metadata from '../generated/parts.json';

import PartsPanel from './PartsPanel.jsx';
import { createPart } from './partModel.js';

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
            socials: [
                {
                    name: 'Telegram',
                    link: 'https://t.me/example',
                },
            ],
        },
    },
];

export default function Editor() {
    const [content, setContent] = useState(() =>
        initialContent.map(({ part, props }) =>
            createPart(part, metadata[part]?.fields, props)
        )
    );

    function addPart(part) {
        const fields = metadata[part]?.fields ?? {};

        setContent((previous) => [
            ...previous,
            createPart(part, fields),
        ]);
    }

    function removePart(id) {
        setContent((previous) =>
            previous.filter((item) => item.id !== id)
        );
    }

    function movePart(id, direction) {
        setContent((previous) => {
            const index = previous.findIndex((item) => item.id === id);
            const target = index + direction;

            if (
                index === -1 ||
                target < 0 ||
                target >= previous.length
            ) {
                return previous;
            }

            const next = [...previous];

            [next[index], next[target]] = [
                next[target],
                next[index],
            ];

            return next;
        });
    }

    function updateProp(id, name, value) {
        setContent((previous) =>
            previous.map((item) =>
                item.id === id
                    ? {
                        ...item,
                        props: {
                            ...item.props,
                            [name]: value,
                        },
                    }
                    : item
            )
        );
    }

    return (
        <main className="editor">
            <PartsPanel
                content={content}
                metadata={metadata}
                onAdd={addPart}
                onRemove={removePart}
                onMove={movePart}
                onPropChange={updateProp}
            />

            <div className="result">
                <h2>Результат</h2>

                <Page content={content} />

                <h2>Данные страницы</h2>
                <pre>{JSON.stringify(
                    content.map(({ part, props }) => ({ part, props })),
                    null,
                    2
                )}</pre>
            </div>
        </main>
    );
}
