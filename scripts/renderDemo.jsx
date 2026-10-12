
import { writeFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import Page from '../layout/Page.jsx';

const content = [
    {
        part: '@kroy/part-hero',
        props: {
            title: 'Ветеринарный врач',
            description: 'Забота о ваших питомцах',
        },
    },
    {
        part: '@kroy/part-contacts',
        props: {
            phone: '+7 999 123-45-67',
            socials: [
                { name: 'Telegram', link: 'https://t.me/example' },
                { name: 'VK', link: 'https://vk.com/example' },
            ],
        },
    },
];

const html = renderToStaticMarkup(<Page content={content} />);

writeFileSync(
    'generated/demo.html',
    `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>Kroy Demo</title>
</head>
<body>
    ${html}
</body>
</html>`
);

console.log('Страница создана: generated/demo.html');
