import { hydrateRoot } from 'react-dom/client';
import SiteApp from '../layout/SiteApp.jsx';
import { parts } from '../dist/kroy/site-parts.mjs';
import { pages } from '../dist/kroy/site-pages.mjs';

const root = document.getElementById('root');

if (!root) {
    throw new Error('Не найден корневой элемент публичной страницы');
}

hydrateRoot(
    root,
    <SiteApp pages={pages} path={location.pathname} parts={parts} />
);
