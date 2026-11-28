import { hydrateRoot } from 'react-dom/client';
import SiteApp, { normalizePathname } from '../../site/runtime/SiteApp.jsx';
import { parts, partTitles, widgets } from '../../dist/kroy/site-parts.mjs';
import { pages, templates } from '../../dist/kroy/site-pages.mjs';
import { theme } from '../../dist/kroy/site-theme.mjs';
import { contacts } from '../../dist/kroy/site-contacts.mjs';
import { footer } from '../../dist/kroy/site-footer.mjs';
import { catalog } from '../../dist/kroy/site-catalog.mjs';
import { reviews } from '../../dist/kroy/site-reviews.mjs';
import '../../site/styles/site.css';

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
        partTitles={partTitles}
        widgets={widgets}
        theme={theme}
        contacts={contacts}
        footer={footer}
        templates={templates}
        catalog={catalog}
        reviews={reviews}
    />
);
