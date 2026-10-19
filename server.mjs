import createApp from '@vyaz/core/createApp.mjs';
import deletePage from './api/deletePage.mjs';
import getPage from './api/getPage.mjs';
import patchPage from './api/patchPage.mjs';
import postPage from './api/postPage.mjs';
import putPage from './api/putPage.mjs';
import restorePage from './api/restorePage.mjs';

await createApp({
    PORT: 3000,
    PAGE_TITLE: 'Kroy',
    routes: [
        {
            path: '/admin',
            title: 'Редактор Kroy',
            component: './pages/EditorPage.jsx',
        },
        {
            path: '/admin/pages',
            title: 'Страницы Kroy',
            component: './pages/PagesPage.jsx',
        },
        {
            path: '/admin/pages/trash',
            title: 'Корзина Kroy',
            component: './pages/TrashPage.jsx',
        },
        {
            path: '/admin/pages/:pageId/edit',
            title: 'Редактор Kroy',
            component: './pages/EditorPage.jsx',
        },
    ],
    api: [
        [
            '/pages',
            { method: 'GET' },
            getPage,
        ],
        [
            '/pages',
            { method: 'POST' },
            postPage,
        ],
        [
            '/pages/:pageId',
            { method: 'GET' },
            getPage,
        ],
        [
            '/pages/:pageId',
            { method: 'PUT' },
            putPage,
        ],
        [
            '/pages/:pageId',
            { method: 'PATCH' },
            patchPage,
        ],
        [
            '/pages/:pageId',
            { method: 'DELETE' },
            deletePage,
        ],
        [
            '/pages/:pageId/restore',
            { method: 'POST' },
            restorePage,
        ],
        [
            '*',
            { method: 'GET' },
            (c) => c.json({ error: 'Not found' }, 404),
        ],
    ],
});
