import createApp from '@vyaz/core/createApp.mjs';
import auth, { hasAccess } from './auth.mjs';
import deletePage from './api/deletePage.mjs';
import getMedia from './api/getMedia.mjs';
import getPage from './api/getPage.mjs';
import getSitePreview from './api/getSitePreview.mjs';
import { getSitePublishStatus, startSitePublish } from './api/sitePublish.mjs';
import patchPage from './api/patchPage.mjs';
import postPage from './api/postPage.mjs';
import postMedia from './api/postMedia.mjs';
import putPage from './api/putPage.mjs';
import restorePage from './api/restorePage.mjs';
import { getSiteThemeSettings, patchSiteTheme } from './api/siteTheme.mjs';
import getSiteSettings from './api/siteSettings.mjs';
import { getSiteContactSettings, patchSiteContactSettings } from './api/siteContact.mjs';
import { getSiteCatalog, patchSiteCatalog } from './api/siteCatalog.mjs';
import { deleteSiteReview, getSiteReviews, patchSiteReview, postReview, postSiteReview } from './api/reviews.mjs';

await createApp({
    auth,
    hasAccess,
    PORT: 3000,
    PAGE_TITLE: 'Oysite',
    LAYOUT_HTML: './components/admin/AdminDocument.jsx',
    LAYOUT_AUTH: './pages/SignInPage.jsx',
    routes: [
        {
            path: '/admin',
            isPrivate: true,
            title: 'Редактор Oysite',
            component: './pages/EditorPage.jsx',
        },
        {
            path: '/admin/pages',
            isPrivate: true,
            title: 'Страницы Oysite',
            component: './pages/PagesPage.jsx',
        },
        {
            path: '/admin/pages/trash',
            isPrivate: true,
            title: 'Корзина Oysite',
            component: './pages/TrashPage.jsx',
        },
        {
            path: '/admin/site/catalog',
            isPrivate: true,
            title: 'Каталог Oysite',
            component: './pages/SitePage.jsx',
        },
        {
            path: '/admin/site/reviews',
            isPrivate: true,
            title: 'Отзывы Oysite',
            component: './pages/SiteReviewsPage.jsx',
        },
        {
            path: '/admin/site',
            isPrivate: true,
            title: 'Оформление сайта Oysite',
            component: './pages/SitePage.jsx',
        },
        {
            path: '/admin/preview',
            isPrivate: true,
            title: 'Предпросмотр Oysite',
            component: './pages/PreviewPage.jsx',
        },
        {
            path: '/admin/pages/:pageId',
            isPrivate: true,
            title: 'Редактор Oysite',
            component: './pages/EditorPage.jsx',
        },
        {
            path: '/admin/*',
            isPrivate: true,
            isServer: true,
            title: 'Редактор Oysite',
            component: './pages/EditorPage.jsx',
        },
    ],
    api: [
        [
            '/reviews',
            { method: 'POST' },
            postReview,
        ],
        [
            '/media',
            { method: 'POST', private: true },
            postMedia,
        ],
        [
            '/media/:mediaId',
            { method: 'GET' },
            getMedia,
        ],
        [
            '/pages',
            { method: 'GET', private: true },
            getPage,
        ],
        [
            '/pages',
            { method: 'POST', private: true },
            postPage,
        ],
        [
            '/pages/:pageId',
            { method: 'GET', private: true },
            getPage,
        ],
        [
            '/pages/:pageId',
            { method: 'PUT', private: true },
            putPage,
        ],
        [
            '/pages/:pageId',
            { method: 'PATCH', private: true },
            patchPage,
        ],
        [
            '/pages/:pageId',
            { method: 'DELETE', private: true },
            deletePage,
        ],
        [
            '/pages/:pageId/restore',
            { method: 'POST', private: true },
            restorePage,
        ],
        [
            '/site/theme',
            { method: 'GET', private: true },
            getSiteThemeSettings,
        ],
        [
            '/site/theme',
            { method: 'PATCH', private: true },
            patchSiteTheme,
        ],
        [
            '/site/settings',
            { method: 'GET', private: true },
            getSiteSettings,
        ],
        [
            '/site/contact',
            { method: 'GET', private: true },
            getSiteContactSettings,
        ],
        [
            '/site/contact',
            { method: 'PATCH', private: true },
            patchSiteContactSettings,
        ],
        [
            '/site/catalog',
            { method: 'GET', private: true },
            getSiteCatalog,
        ],
        [
            '/site/catalog',
            { method: 'PATCH', private: true },
            patchSiteCatalog,
        ],
        [
            '/site/reviews',
            { method: 'GET', private: true },
            getSiteReviews,
        ],
        [
            '/site/reviews',
            { method: 'POST', private: true },
            postSiteReview,
        ],
        [
            '/site/reviews/:id',
            { method: 'PATCH', private: true },
            patchSiteReview,
        ],
        [
            '/site/reviews/:id',
            { method: 'DELETE', private: true },
            deleteSiteReview,
        ],
        [
            '/site/preview',
            { method: 'GET', private: true },
            getSitePreview,
        ],
        [
            '/site/publish',
            { method: 'GET', private: true },
            getSitePublishStatus,
        ],
        [
            '/site/publish',
            { method: 'POST', private: true },
            startSitePublish,
        ],
        [
            '*',
            { method: 'GET', private: true },
            (c) => c.json({ error: 'Not found' }, 404),
        ],
    ],
});
