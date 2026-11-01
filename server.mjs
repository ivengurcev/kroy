import createApp from '@vyaz/core/createApp.mjs';
import auth, { hasAccess } from './server/auth.mjs';
import deletePage from './server/api/deletePage.mjs';
import getMedia from './server/api/getMedia.mjs';
import getPage from './server/api/getPage.mjs';
import getSitePreview from './server/api/getSitePreview.mjs';
import { getSitePublishStatus, startSitePublish } from './server/api/sitePublish.mjs';
import patchPage from './server/api/patchPage.mjs';
import postPage from './server/api/postPage.mjs';
import postDetailTemplate from './server/api/postDetailTemplate.mjs';
import postMedia from './server/api/postMedia.mjs';
import putPage from './server/api/putPage.mjs';
import restorePage from './server/api/restorePage.mjs';
import { getSiteThemeSettings, patchSiteTheme } from './server/api/siteTheme.mjs';
import getSiteSettings from './server/api/siteSettings.mjs';
import { getSiteContactSettings, patchSiteContactSettings } from './server/api/siteContact.mjs';
import { getSiteCatalog, patchSiteCatalog } from './server/api/siteCatalog.mjs';
import { getSitePayments, patchSitePaymentSettings, patchSitePaymentActivation, deleteSitePaymentSecretKey } from './server/api/sitePayments.mjs';
import { getPaymentStatus, postPaymentStart } from './server/api/checkout.mjs';
import { deleteSiteReview, getSiteReviews, patchSiteReview, postReview, postSiteReview } from './server/api/reviews.mjs';
import { deleteSiteArticle, getSiteArticle, getSiteArticles, patchSiteArticle, postSiteArticle } from './server/api/articles.mjs';

await createApp({
    auth,
    hasAccess,
    PORT: 3000,
    PAGE_TITLE: 'Oysite',
    LAYOUT_HTML: './admin/components/AdminDocument.jsx',
    LAYOUT_AUTH: './admin/pages/SignInPage.jsx',
    routes: [
        {
            path: '/admin',
            isPrivate: true,
            title: 'Редактор Oysite',
            component: './admin/pages/EditorPage.jsx',
        },
        {
            path: '/admin/pages',
            isPrivate: true,
            title: 'Страницы Oysite',
            component: './admin/pages/PagesPage.jsx',
        },
        {
            path: '/admin/pages/trash',
            isPrivate: true,
            title: 'Корзина Oysite',
            component: './admin/pages/TrashPage.jsx',
        },
        {
            path: '/admin/site/catalog',
            isPrivate: true,
            title: 'Каталог Oysite',
            component: './admin/pages/SitePage.jsx',
        },
        {
            path: '/admin/site/payments',
            isPrivate: true,
            title: 'Платежи Oysite',
            component: './admin/pages/SitePaymentsPage.jsx',
        },
        {
            path: '/admin/site/reviews',
            isPrivate: true,
            title: 'Отзывы Oysite',
            component: './admin/pages/SiteReviewsPage.jsx',
        },
        {
            path: '/admin/site/articles/new',
            isPrivate: true,
            title: 'Новая статья Oysite',
            component: './admin/pages/SiteArticleEditorPage.jsx',
        },
        {
            path: '/admin/site/articles/:id',
            isPrivate: true,
            title: 'Редактор статьи Oysite',
            component: './admin/pages/SiteArticleEditorPage.jsx',
        },
        {
            path: '/admin/site/articles',
            isPrivate: true,
            title: 'Статьи Oysite',
            component: './admin/pages/SiteArticlesPage.jsx',
        },
        {
            path: '/admin/site',
            isPrivate: true,
            title: 'Оформление сайта Oysite',
            component: './admin/pages/SitePage.jsx',
        },
        {
            path: '/admin/preview',
            isPrivate: true,
            title: 'Предпросмотр Oysite',
            component: './admin/pages/PreviewPage.jsx',
        },
        {
            path: '/admin/pages/:pageId',
            isPrivate: true,
            title: 'Редактор Oysite',
            component: './admin/pages/EditorPage.jsx',
        },
        {
            path: '/admin/*',
            isPrivate: true,
            isServer: true,
            title: 'Редактор Oysite',
            component: './admin/pages/EditorPage.jsx',
        },
    ],
    api: [
        [
            '/payments/status',
            { method: 'GET' },
            getPaymentStatus,
        ],
        [
            '/payments/start',
            { method: 'POST' },
            postPaymentStart,
        ],
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
            '/pages/:pageId/detail-template',
            { method: 'POST', private: true },
            postDetailTemplate,
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
            '/site/payments',
            { method: 'GET', private: true },
            getSitePayments,
        ],
        [
            '/site/payments/:provider',
            { method: 'PATCH', private: true },
            patchSitePaymentSettings,
        ],
        [
            '/site/payments/:provider/secret-key',
            { method: 'DELETE', private: true },
            deleteSitePaymentSecretKey,
        ],
        [
            '/site/payments/:provider/activation',
            { method: 'PATCH', private: true },
            patchSitePaymentActivation,
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
            '/site/articles',
            { method: 'GET', private: true },
            getSiteArticles,
        ],
        [
            '/site/articles',
            { method: 'POST', private: true },
            postSiteArticle,
        ],
        [
            '/site/articles/:id',
            { method: 'GET', private: true },
            getSiteArticle,
        ],
        [
            '/site/articles/:id',
            { method: 'PATCH', private: true },
            patchSiteArticle,
        ],
        [
            '/site/articles/:id',
            { method: 'DELETE', private: true },
            deleteSiteArticle,
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
