import { hydrateRoot } from 'react-dom/client';
import SiteApp, { normalizePathname } from '../layout/SiteApp.jsx';
import { parts } from '../dist/kroy/site-parts.mjs';
import { pages } from '../dist/kroy/site-pages.mjs';
import { theme } from '../dist/kroy/site-theme.mjs';
import '../layout/site.css';

const root = document.getElementById('root');

if (!root) {
    throw new Error('Не найден корневой элемент публичной страницы');
}

hydrateRoot(
    root,
    <SiteApp
        pages={pages}
        path={normalizePathname(location.pathname)}
        parts={parts}
        theme={theme}
    />
);
