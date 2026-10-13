
import { mkdirSync, writeFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import Page from '../layout/Page.jsx';
import { parts } from '../dist/kroy/site-parts.mjs';
import content from '../demo/page.json';

const html = renderToStaticMarkup(<Page content={content} parts={parts} />);

mkdirSync('dist/sites/demo', { recursive: true });
writeFileSync(
    'dist/sites/demo/index.html',
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

console.log('Страница создана: dist/sites/demo/index.html');
