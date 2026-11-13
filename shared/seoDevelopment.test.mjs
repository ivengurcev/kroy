import assert from 'node:assert/strict';
import test from 'node:test';
import { getSiteSeoContext, resolvePageMeta, metaTags } from './seo.mjs';
import { createRobots, createSitemap } from '../build/site/seoFiles.mjs';
import { renderNginxConfig } from '../build/nginx/generateNginxConfig.mjs';

const site = { slug: 'demo', name: 'Demo', seo: { description: 'Description', indexable: true, imageUrl: '/_kroy/releases/20261113000000000/assets/seo/image.webp' } };
const page = { path: '/about', title: 'About' };
const domains = ['demo.localhost'];

test('development builds complete local metadata, robots and sitemap without mutating saved SEO', () => {
    const before = structuredClone(site);
    const context = getSiteSeoContext(site, domains, { NODE_ENV: 'development', NGINX_LISTEN: '0.0.0.0:9123' });
    const meta = resolvePageMeta(site, page, undefined, context);
    assert.equal(meta.canonical, 'http://demo.localhost:9123/about');
    assert.equal(meta.image, `http://demo.localhost:9123${site.seo.imageUrl}`);
    assert.equal(meta.robots, 'noindex, follow');
    const tags = metaTags(meta);
    assert.equal(tags.find(([, key]) => key === 'og:url')[2], meta.canonical);
    assert.equal(tags.find(([, key]) => key === 'og:image')[2], meta.image);
    assert.equal(tags.find(([, key]) => key === 'twitter:image')[2], meta.image);
    assert.match(createRobots(context.origin), /Sitemap: http:\/\/demo.localhost:9123\/sitemap.xml/);
    const pages = [{ ...page, meta }];
    assert.match(createSitemap(pages, context), /<loc>http:\/\/demo.localhost:9123\/about<\/loc>/);
    assert.doesNotMatch(createSitemap(pages), /<loc>/); // Production still excludes noindex.
    assert.deepEqual(site, before);
});
test('published dev origin uses external protocol/port and omits standard ports', () => {
    for (const [endpoint, expected] of [
        ['http://localhost:80', 'http://demo.localhost'],
        ['https://localhost:443', 'https://demo.localhost'],
        ['https://localhost:9443', 'https://demo.localhost:9443'],
        ['http://localhost:9000', 'http://demo.localhost:9000'],
    ]) {
        const context = getSiteSeoContext(site, domains, { NODE_ENV: 'development', KROY_DEV_ORIGIN: endpoint, NGINX_LISTEN: '0.0.0.0:7000' });
        assert.equal(context.origin, expected);
        assert.equal(resolvePageMeta(site, page, undefined, context).canonical, `${expected}/about`);
    }
    assert.equal(getSiteSeoContext(site, domains, { NODE_ENV: 'development', NGINX_LISTEN: '80' }).origin, 'http://demo.localhost');
});
test('local fallback hostname and HTTP listener match the common Nginx config', () => {
    const env = { NODE_ENV: 'development', NGINX_LISTEN: '0.0.0.0:9123' };
    const context = getSiteSeoContext(site, domains, env);
    const config = renderNginxConfig(site.slug, domains, { listen: env.NGINX_LISTEN });
    assert.match(config, /server_name "demo.localhost";/);
    assert.match(config, /listen 0.0.0.0:9123;/);
    assert.equal(new URL(context.origin).port, '9123');
    assert.throws(() => getSiteSeoContext(site, ['other.localhost'], env), /Привяжите локальный домен demo.localhost/);
});
test('development keeps an explicitly chosen public primary domain but always uses noindex', () => {
    const publicSite = { ...site, seo: { ...site.seo, primaryDomain: 'demo.example.org' } };
    const context = getSiteSeoContext(publicSite, ['demo.example.org'], { NODE_ENV: 'development' });
    assert.equal(context.origin, 'https://demo.example.org');
    assert.equal(resolvePageMeta(publicSite, page, undefined, context).robots, 'noindex, follow');
});
test('production retains public domain selection and never uses local fallback or env origin', () => {
    for (const NODE_ENV of ['production', undefined, 'test']) {
        const env = { NODE_ENV, KROY_DEV_ORIGIN: 'http://localhost:9000', NGINX_LISTEN: '0.0.0.0:9000' };
        assert.throws(() => getSiteSeoContext(site, domains, env), /публичный основной домен/);
        const context = getSiteSeoContext(site, [...domains, 'demo.example.org'], env);
        const meta = resolvePageMeta(site, page, undefined, context);
        assert.equal(meta.canonical, 'https://demo.example.org/about');
        assert.equal(meta.robots, 'index, follow');
        assert.doesNotMatch(createSitemap([{ ...page, meta }], context), /localhost/);
        const rejected = resolvePageMeta(site, page, undefined, { origin: 'http://demo.localhost:9000' });
        assert.equal(rejected.canonical, null);
        assert.equal(rejected.image, null);
    }
    assert.throws(() => getSiteSeoContext({ ...site, seo: { primaryDomain: 'demo.localhost' } }, domains, { NODE_ENV: 'production' }));
    assert.throws(() => getSiteSeoContext({ ...site, seo: { primaryDomain: 'other.example.org' } }, ['demo.example.org'], { NODE_ENV: 'production' }));
});
test('development requires a usable server endpoint instead of guessing a port', () => {
    assert.throws(() => getSiteSeoContext(site, domains, { NODE_ENV: 'development' }), /KROY_DEV_ORIGIN или NGINX_LISTEN/);
    for (const endpoint of ['ftp://localhost:9000', 'http://localhost/path', 'http://user:pass@localhost', 'http://localhost?query']) {
        assert.throws(() => getSiteSeoContext(site, domains, { NODE_ENV: 'development', KROY_DEV_ORIGIN: endpoint }));
    }
});
