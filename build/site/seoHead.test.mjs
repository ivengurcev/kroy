import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { resolvePageMeta } from '../../shared/seo.mjs';

test('SSR outputs complete static and material heads without JS, escaping untrusted text', async () => {
    const result = await build({ entryPoints: ['site/runtime/SeoHead.jsx'], bundle: true, write: false, format: 'esm', platform: 'node', jsx: 'automatic' });
    const { default: SeoHead } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
    const site = { name: 'Клиника', seo: { primaryDomain: 'clinic.example.org', description: 'Помогаем животным', imageUrl: '/_kroy/releases/20261113000000000/assets/seo/site.webp' } };
    for (const page of [
        { title: 'О нас', path: '/about' },
        { title: 'Материал', path: '/news/new', dataSource: 'materials', record: { title: 'Материал', summary: 'Описание материала' } },
    ]) {
        const html = renderToStaticMarkup(createElement('html', null, createElement('head', null, createElement(SeoHead, { meta: resolvePageMeta(site, page) }))));
        assert.match(html, /<title>/);
        for (const key of ['description', 'robots', 'og:title', 'og:description', 'og:image', 'og:url', 'og:type', 'og:site_name', 'twitter:card', 'twitter:title', 'twitter:description', 'twitter:image']) assert.ok(html.includes(`="${key}"`), key);
        assert.ok(html.includes(`href="https://clinic.example.org${page.path}"`));
        assert.doesNotMatch(html, /<script/);
        if (page.record) assert.match(html, /property="og:type" content="article"/);
    }
    const html = renderToStaticMarkup(createElement(SeoHead, { meta: resolvePageMeta(site, { title: '<script>"&', path: '/' }) }));
    assert.doesNotMatch(html, /<script>/);
    assert.match(html, /&lt;script&gt;/);
});
