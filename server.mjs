import createApp from '@vyaz/core/createApp.mjs';

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
});
