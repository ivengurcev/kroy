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
import { getSiteOrders, getSiteOrder, postCompleteOrder, getPublicOrderStatus, postProdamusWebhook, getOrderNotifications, patchOrderNotifications } from './server/api/orders.mjs';
import { deleteSiteReview, getSiteReviews, patchSiteReview, postReview, postSiteReview } from './server/api/reviews.mjs';
import { deleteSiteMaterial, getSiteMaterial, getSiteMaterials, patchSiteMaterial, postSiteMaterial } from './server/api/materials.mjs';
import { deleteSiteMaterialSection, getSiteMaterialSections, patchSiteMaterialSection, postSiteMaterialSection } from './server/api/materialSections.mjs';

await createApp({
    auth,
    hasAccess,
    PORT: 3000,
    PAGE_TITLE: 'Oysite',
    LAYOUT_HTML: './admin/components/AdminDocument.jsx',
    LAYOUT_APP: './admin/components/AdminApplication.jsx',
    LAYOUT_AUTH: './admin/pages/SignInPage.jsx',
    routes: [
        {
            path: '/admin',
            isPrivate: true,
            disableSSR: true,
            title: 'Редактор Oysite',
            component: './admin/pages/EditorPage.jsx',
        },
        {
            path: '/admin/pages',
            isPrivate: true,
            disableSSR: true,
            title: 'Страницы Oysite',
            component: './admin/pages/PagesPage.jsx',
        },
        {
            path: '/admin/pages/trash',
            isPrivate: true,
            disableSSR: true,
            title: 'Корзина Oysite',
            component: './admin/pages/TrashPage.jsx',
        },
        {
            path: '/admin/catalog',
            isPrivate: true,
            disableSSR: true,
            title: 'Каталог Oysite',
            component: './admin/pages/SitePage.jsx',
        },
        {
            path: '/admin/payments',
            isPrivate: true,
            disableSSR: true,
            title: 'Платежи Oysite',
            component: './admin/pages/SitePaymentsPage.jsx',
        },
        {
            path: '/admin/orders',
            isPrivate: true,
            disableSSR: true,
            title: 'Заказы Oysite',
            component: './admin/pages/SiteOrdersPage.jsx',
        },
        {
            path: '/admin/reviews',
            isPrivate: true,
            disableSSR: true,
            title: 'Отзывы Oysite',
            component: './admin/pages/SiteReviewsPage.jsx',
        },
        {
            path: '/admin/materials/new',
            isPrivate: true,
            disableSSR: true,
            title: 'Новый материал Oysite',
            component: './admin/pages/SiteMaterialEditorPage.jsx',
        },
        {
            path: '/admin/materials/:id',
            isPrivate: true,
            disableSSR: true,
            title: 'Редактор материала Oysite',
            component: './admin/pages/SiteMaterialEditorPage.jsx',
        },
        {
            path: '/admin/materials',
            isPrivate: true,
            disableSSR: true,
            title: 'Материалы Oysite',
            component: './admin/pages/SiteMaterialsPage.jsx',
        },
        {
            path: '/admin/appearance',
            isPrivate: true,
            disableSSR: true,
            title: 'Оформление сайта Oysite',
            component: './admin/pages/SitePage.jsx',
        },
        {
            path: '/admin/contacts',
            isPrivate: true,
            disableSSR: true,
            title: 'Контакты Oysite',
            component: './admin/pages/SitePage.jsx',
        },
        {
            path: '/admin/seo',
            isPrivate: true,
            disableSSR: true,
            title: 'SEO Oysite',
            component: './admin/pages/SitePage.jsx',
        },
        {
            path: '/admin/overview',
            isPrivate: true,
            disableSSR: true,
            title: 'Сайт Oysite',
            component: './admin/pages/SitePage.jsx',
        },
        {
            path: '/admin/preview',
            isPrivate: true,
            disableSSR: true,
            title: 'Предпросмотр Oysite',
            component: './admin/pages/PreviewPage.jsx',
        },
        {
            path: '/admin/pages/:pageId',
            isPrivate: true,
            disableSSR: true,
            title: 'Редактор Oysite',
            component: './admin/pages/EditorPage.jsx',
        },
    ],
    api: [
        ['/payments/prodamus/webhook', { method: 'POST' }, postProdamusWebhook],
        ['/payments/orders/:token', { method: 'GET' }, getPublicOrderStatus],
        ['/site/orders', { method: 'GET', private: true }, getSiteOrders],
        ['/site/orders/:id', { method: 'GET', private: true }, getSiteOrder],
        ['/site/orders/:id/complete', { method: 'POST', private: true }, postCompleteOrder],
        ['/site/order-notifications', { method: 'GET', private: true }, getOrderNotifications],
        ['/site/order-notifications', { method: 'PATCH', private: true }, patchOrderNotifications],
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
            '/site/material-sections',
            { method: 'GET', private: true },
            getSiteMaterialSections,
        ],
        [
            '/site/material-sections',
            { method: 'POST', private: true },
            postSiteMaterialSection,
        ],
        [
            '/site/material-sections/:id',
            { method: 'PATCH', private: true },
            patchSiteMaterialSection,
        ],
        [
            '/site/material-sections/:id',
            { method: 'DELETE', private: true },
            deleteSiteMaterialSection,
        ],
        [
            '/site/materials',
            { method: 'GET', private: true },
            getSiteMaterials,
        ],
        [
            '/site/materials',
            { method: 'POST', private: true },
            postSiteMaterial,
        ],
        [
            '/site/materials/:id',
            { method: 'GET', private: true },
            getSiteMaterial,
        ],
        [
            '/site/materials/:id',
            { method: 'PATCH', private: true },
            patchSiteMaterial,
        ],
        [
            '/site/materials/:id',
            { method: 'DELETE', private: true },
            deleteSiteMaterial,
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
