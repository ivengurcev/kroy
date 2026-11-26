import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { getPageTheme } from '../themes/themeRegistry.mjs';

// Exercise the existing navigation/effect handlers without a browser or DOM library.
test('SiteApp switches page tokens on links and Back/Forward while footer keeps global tokens and one payment interface', async (t) => {
    let cursor = 0;
    const cells = [];
    let effects = [];
    const runtime = {
        useState(initial) {
            const index = cursor++;
            if (!(index in cells)) cells[index] = initial;
            return [cells[index], (value) => { cells[index] = typeof value === 'function' ? value(cells[index]) : value; }];
        },
        useEffect(fn, deps) {
            const index = cursor++;
            const previous = cells[index];
            if (!previous || deps.some((value, i) => value !== previous.deps[i])) {
                effects.push(() => { previous?.cleanup?.(); cells[index] = { deps, cleanup: fn() }; });
            }
        },
    };
    const previous = Object.fromEntries(['window', 'document', 'history', 'Element', '__kroyAppearanceRuntime'].map((name) => [name, globalThis[name]]));
    const documentEvents = new Map();
    const windowEvents = new Map();
    const mediaEvents = new Map();
    const location = { href: 'https://example.com/', origin: 'https://example.com', assign() { assert.fail('Unexpected full navigation'); } };
    const media = { matches: true, addEventListener: (name, fn) => mediaEvents.set(name, fn), removeEventListener: (name) => mediaEvents.delete(name) };
    globalThis.__kroyAppearanceRuntime = runtime;
    globalThis.document = { addEventListener: (name, fn) => documentEvents.set(name, fn), removeEventListener: (name) => documentEvents.delete(name) };
    globalThis.window = { location, matchMedia: () => media, addEventListener: (name, fn) => windowEvents.set(name, fn), removeEventListener: (name) => windowEvents.delete(name) };
    globalThis.history = { pushState: (_, __, url) => { location.href = String(url); } };
    globalThis.Element = class { constructor(link) { this.link = link; } closest() { return this.link; } };
    t.after(() => {
        for (const cell of cells) cell?.cleanup?.();
        for (const [name, value] of Object.entries(previous)) {
            if (value === undefined) delete globalThis[name];
            else globalThis[name] = value;
        }
    });
    const compiled = await build({
        stdin: { contents: "export { default as SiteApp } from './site/runtime/SiteApp.jsx';", resolveDir: process.cwd() },
        bundle: true, write: false, format: 'esm', jsx: 'automatic',
        plugins: [{ name: 'appearance-unit', setup(builder) {
            builder.onResolve({ filter: /^(react|react\/jsx-runtime)$|\/(Page|PaymentResult)\.jsx$|separatorContext\.js$|\.module\.css$/ }, ({ path }) => ({ path, namespace: 'unit' }));
            builder.onLoad({ filter: /./, namespace: 'unit' }, ({ path }) => {
                if (path === 'react') return { contents: 'export const {useState,useEffect} = globalThis.__kroyAppearanceRuntime;' };
                if (path === 'react/jsx-runtime') return { contents: 'export const Fragment = "fragment"; export const jsx = (type,props) => ({type,props}); export const jsxs = jsx;' };
                if (path.endsWith('separatorContext.js')) return { contents: 'export default {Provider:"separator"};' };
                if (path.endsWith('.css')) return { contents: 'export default {theme:"site-theme"};' };
                if (path.endsWith('PaymentResult.jsx')) return { contents: 'export default function PaymentResult(){return {type:"payment-result",props:{}};}' };
                return { contents: 'export default function Component(){return null;}' };
            });
        } }],
    });
    const { SiteApp } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
    const site = { themeId: 'calm', themeMode: 'light', overrides: { light: { '--site-color-bg': '#eeddcc' } } };
    const theme = { ...getPageTheme(site), separatorUrl: '/global.svg', separatorMimeType: 'image/svg+xml' };
    const pages = {
        '/': { path: '/', title: 'Home', content: [] },
        '/services': { path: '/services', title: 'Services', content: [], theme: getPageTheme(site, { themeMode: 'system', overrides: { light: { '--site-color-bg': '#ffffff' }, shared: { '--site-font-size-base': '20px' } } }) },
    };
    function render() {
        cursor = 0;
        effects = [];
        const nodes = [];
        function visit(element) {
            if (!element) return;
            if (Array.isArray(element)) return element.forEach(visit);
            if (typeof element.type === 'function') return visit(element.type(element.props));
            nodes.push(element);
            visit(element.props?.children);
        }
        visit(SiteApp({ pages, path: '/', theme, parts: {}, widgets: {} }));
        const root = nodes.find(({ props }) => props?.className === 'site-theme');
        const roots = nodes.filter(({ props }) => props?.className === 'site-theme');
        assert.equal(roots.length, 2);
        assert.deepEqual(roots[1].props.style, { ...theme.light, colorScheme: 'light' });
        assert.equal(nodes.filter(({ type }) => type === 'footer').length, 1);
        assert.equal(nodes.filter(({ type }) => type === 'payment-result').length, 1);
        assert.equal(nodes.filter(({ type, props }) => type === 'a' && props.href === 'https://oysite.ru/').length, 1);
        assert.deepEqual(nodes.find(({ type }) => type === 'separator').props.value, { src: '/global.svg', mimeType: 'image/svg+xml' });
        for (const effect of effects) effect();
        return root.props.style;
    }
    const home = render();
    assert.equal(home['--site-color-bg'], '#eeddcc');
    let prevented = false;
    documentEvents.get('click')({ button: 0, target: new Element({ href: 'https://example.com/services', hasAttribute: () => false }), preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
    assert.equal(render()['--site-color-bg'], '#ffffff'); // SSR/initial system palette is light.
    const systemDark = render();
    assert.equal(systemDark.colorScheme, 'dark');
    assert.equal(systemDark['--site-font-size-base'], '20px');
    media.matches = false;
    mediaEvents.get('change')();
    assert.equal(render()['--site-color-bg'], '#ffffff');
    location.href = 'https://example.com/';
    windowEvents.get('popstate')();
    assert.deepEqual(render(), home);
    location.href = 'https://example.com/services';
    windowEvents.get('popstate')();
    assert.equal(render()['--site-font-size-base'], '20px');
});
