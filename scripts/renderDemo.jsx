
import { writeFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import Page from '../layout/Page.jsx';
import { parts } from '../generated/site-parts.mjs';
import content from '../demo/page.json';

const html = renderToStaticMarkup(<Page content={content} parts={parts} />);

writeFileSync(
    'generated/index.html',
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

console.log('Страница создана: generated/index.html');
