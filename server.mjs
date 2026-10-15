import createApp from '@vyaz/core/createApp.mjs';
import getPage from './api/getPage.mjs';
import putPage from './api/putPage.mjs';

await createApp({
    PORT: 3000,
    PAGE_TITLE: 'Kroy',
    routes: [
        {
            path: '/admin',
            title: 'Редактор Kroy',
            component: './editor/Editor.jsx',
        },
        {
            path: '/admin/pages',
            title: 'Страницы Kroy',
            component: './editor/Pages.jsx',
        },
        {
            path: '/admin/pages/:pageId/edit',
            title: 'Редактор Kroy',
            component: './editor/Editor.jsx',
        },
    ],
    api: [
        [
            '/pages',
            { method: 'GET' },
            getPage,
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
            '*',
            { method: 'GET' },
            (c) => c.json({ error: 'Not found' }, 404),
        ],
    ],
});
