import createApp from '@vyaz/core/createApp.mjs';
import getPage from './api/getPage.mjs';

await createApp({
    PORT: 3000,
    PAGE_TITLE: 'Kroy',
    routes: [
        {
            path: '/',
            title: 'Редактор Kroy',
            component: './editor/Editor.jsx',
        },
    ],
    api: [
        [
            '/sites/:siteId/pages/:pageId',
            { method: 'GET' },
            getPage,
        ],
    ],
});
