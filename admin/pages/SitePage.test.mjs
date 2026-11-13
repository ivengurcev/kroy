import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';

test('SitePage saves only the active form and retains other settings drafts when switching sections', async (t) => {
    // Exercise the actual component callbacks without a browser or extra React dependencies.
    const slots = [];
    let cursor = 0;
    let pending = false;
    let effects = [];
    let pathname = '/admin/appearance';
    let tree;
    const listeners = new Map();
    const requests = [];
    const runtime = {
        useContext: () => ({ pathname }),
        useMemo: (fn) => fn(),
        useState(initial) {
            const index = cursor++;
            if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
            return [slots[index], (next) => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; pending = true; }];
        },
        useEffect(fn, deps) {
            const index = cursor++;
            const previous = slots[index];
            if (previous && deps.every((value, i) => Object.is(value, previous.deps[i]))) return;
            effects.push(() => { previous?.cleanup?.(); slots[index] = { deps, cleanup: fn() }; });
        },
        async apiRequest(url, options) {
            requests.push({ url, body: JSON.parse(options.body) });
            return { ok: true, json: async () => JSON.parse(options.body) };
        },
    };
    globalThis.__kroySitePageTest = runtime;
    const oldWindow = globalThis.window;
    const oldDocument = globalThis.document;
    globalThis.window = { addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: (name) => listeners.delete(name) };
    globalThis.document = { getElementById: (id) => ({ requestSubmit: () => find((node) => node.props.id === id).props.onSubmit({ preventDefault() {} }) }) };
    t.after(() => {
        delete globalThis.__kroySitePageTest;
        if (oldWindow === undefined) delete globalThis.window; else globalThis.window = oldWindow;
        if (oldDocument === undefined) delete globalThis.document; else globalThis.document = oldDocument;
    });
    t.mock.method(globalThis, 'fetch', async (url) => ({ ok: true, json: async () => url.endsWith('/theme')
        ? { settings: { themeId: 'calm', themeMode: 'light', overrides: {} }, themes: [{ id: 'calm' }, { id: 'other' }] }
        : { site: { name: 'Site' }, contacts: { address: 'Saved', socials: [] }, seo: {} } }));

    const result = await build({
        entryPoints: ['admin/pages/SitePage.jsx'], bundle: true, write: false, format: 'esm', jsx: 'automatic',
        plugins: [{ name: 'site-page-unit', setup(builder) {
            builder.onResolve({ filter: /^react$/ }, () => ({ path: 'react', namespace: 'unit' }));
            builder.onResolve({ filter: /^react\/jsx-runtime$/ }, () => ({ path: 'jsx', namespace: 'unit' }));
            builder.onResolve({ filter: /./ }, (args) => {
                if (!args.importer || args.path.endsWith('siteSettingsState.mjs') || args.path.endsWith('SiteSettingsLayout.jsx')) return;
                return { path: args.path, namespace: 'unit' };
            });
            builder.onLoad({ filter: /./, namespace: 'unit' }, ({ path }) => {
                if (path === 'react') return { contents: 'const r = globalThis.__kroySitePageTest; export const {useState,useEffect,useContext,useMemo} = r;' };
                if (path === 'jsx') return { contents: 'export const Fragment = "fragment"; export const jsx = (type,props) => ({type,props}); export const jsxs = jsx;' };
                if (path.endsWith('apiRequest.mjs')) return { contents: 'export const apiRequest = (...args) => globalThis.__kroySitePageTest.apiRequest(...args);' };
                if (path.endsWith('formValidation.mjs')) return { contents: 'export const formResponseError = async () => "Error";' };
                return { contents: `export default ${JSON.stringify(path.endsWith('.css') ? {} : path.split('/').pop().replace('.jsx', ''))};` };
            });
        } }],
    });
    const { default: SitePage } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
    function render() {
        do { pending = false; cursor = 0; effects = []; tree = SitePage(); for (const effect of effects) effect(); } while (pending);
        return tree;
    }
    function find(predicate, node = tree) {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) return node.map((item) => find(predicate, item)).find(Boolean);
        if (predicate(node)) return node;
        return find(predicate, node.props?.children ?? null);
    }
    const named = (name) => find((node) => node.type === name || node.type?.name === name);
    const switchTo = (section) => { pathname = `/admin/${section}`; render(); };
    const settled = async () => { await new Promise(setImmediate); render(); };

    render(); await settled();
    assert.equal(tree.props.isDirty, false);
    named('ThemePicker').props.onChange('other'); render();
    assert.equal(tree.props.isDirty, true);
    switchTo('seo');
    assert.equal(tree.props.isDirty, false);
    assert.equal(tree.props.hasUnsavedChanges, true);
    assert.ok(listeners.has('beforeunload'));
    tree.props.onSave(); await settled();
    assert.equal(requests.length, 0);
    named('SeoFields').props.onChange({ description: 'SEO draft' }); render();
    assert.equal(tree.props.isDirty, true);
    tree.props.onSave(); await settled();
    assert.deepEqual(requests.map(({ url }) => url), ['/api/site/seo']);
    assert.equal(tree.props.isDirty, false);
    assert.equal(tree.props.hasUnsavedChanges, true);
    switchTo('appearance');
    assert.equal(named('ThemePicker').props.selectedId, 'other');
    assert.equal(tree.props.isDirty, true);
    switchTo('contacts');
    assert.equal(tree.props.isDirty, false);
    named('ContactSettings').props.onChange({ address: 'Contact draft' }); render();
    switchTo('appearance');
    tree.props.onSave(); await settled();
    assert.deepEqual(requests.map(({ url }) => url), ['/api/site/seo', '/api/site/theme']);
    assert.equal(tree.props.isDirty, false);
    assert.equal(tree.props.hasUnsavedChanges, true);
    switchTo('contacts');
    assert.equal(named('ContactSettings').props.value.address, 'Contact draft');
    named('ContactSettings').props.onSave(); await settled();
    assert.deepEqual(requests.map(({ url }) => url), ['/api/site/seo', '/api/site/theme', '/api/site/contact']);
    assert.equal(tree.props.hasUnsavedChanges, false);
    assert.equal(listeners.has('beforeunload'), false);
});
