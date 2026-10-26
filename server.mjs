import createApp from '@vyaz/core/createApp.mjs';
import auth, { hasAccess } from './auth.mjs';
import deletePage from './api/deletePage.mjs';
import getMedia from './api/getMedia.mjs';
import getPage from './api/getPage.mjs';
import patchPage from './api/patchPage.mjs';
import postPage from './api/postPage.mjs';
import postMedia from './api/postMedia.mjs';
import putPage from './api/putPage.mjs';
import restorePage from './api/restorePage.mjs';

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
            '*',
            { method: 'GET', private: true },
            (c) => c.json({ error: 'Not found' }, 404),
        ],
    ],
});
