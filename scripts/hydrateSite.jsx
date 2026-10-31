import { hydrateRoot } from 'react-dom/client';
import SiteApp, { normalizePathname } from '../layout/SiteApp.jsx';
import { parts, widgets } from '../dist/kroy/site-parts.mjs';
import { pages } from '../dist/kroy/site-pages.mjs';
import { theme } from '../dist/kroy/site-theme.mjs';
import { contacts } from '../dist/kroy/site-contacts.mjs';
import { catalog } from '../dist/kroy/site-catalog.mjs';
import { reviews } from '../dist/kroy/site-reviews.mjs';
import '../layout/site.css';

const root = document.getElementById('root');
const pageData = document.getElementById('kroy-page-data');
const initialPage = pageData ? JSON.parse(pageData.textContent) : undefined;

if (!root) {
    throw new Error('Не найден корневой элемент публичной страницы');
}

hydrateRoot(
    root,
    <SiteApp
        pages={pages}
        path={normalizePathname(location.pathname)}
        initialPage={initialPage}
        parts={parts}
        widgets={widgets}
        theme={theme}
        contacts={contacts}
        catalog={catalog}
        reviews={reviews}
    />
);
