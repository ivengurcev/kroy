import { hydrateRoot } from 'react-dom/client';
import SiteApp from '../layout/SiteApp.jsx';
import { parts } from '../dist/kroy/site-parts.mjs';

const root = document.getElementById('root');
const data = document.getElementById('kroy-page-data');

if (!root || !data) {
    throw new Error('Не найдены данные для гидратации публичной страницы');
}

const page = JSON.parse(data.textContent);

hydrateRoot(root, <SiteApp page={page} parts={parts} />);
