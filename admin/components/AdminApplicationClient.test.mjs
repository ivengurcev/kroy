import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';

test('registered navigation guard exempts preserved settings only, for navigate and Back/Forward', async (t) => {
    let guard;
    let confirmed = false;
    let prompts = 0;
    const effects = [];
    const listeners = new Map();
    const runtime = {
        useContext: () => ({ pathname: '/admin/appearance', setNavigationGuard: (next) => { guard = next; } }),
        useState: (initial) => [initial, () => {}],
        useRef: (current) => ({ current }),
        useCallback: (fn) => fn,
        useMemo: (fn) => fn(),
        useEffect: (fn) => effects.push(fn),
    };
    globalThis.__kroyNavigationGuardTest = runtime;
    const oldWindow = globalThis.window;
    const oldDocument = globalThis.document;
    globalThis.window = {
        confirm: () => { prompts += 1; return confirmed; },
        addEventListener: (name, fn) => listeners.set(name, fn),
        removeEventListener: (name) => listeners.delete(name),
    };
    globalThis.document = { addEventListener() {}, removeEventListener() {} };
    const cleanups = [];
    t.after(() => {
        for (const cleanup of cleanups) cleanup?.();
        delete globalThis.__kroyNavigationGuardTest;
        if (oldWindow === undefined) delete globalThis.window; else globalThis.window = oldWindow;
        if (oldDocument === undefined) delete globalThis.document; else globalThis.document = oldDocument;
    });
    // Test the callback actually installed by the component, without a browser.
    const result = await build({
        entryPoints: ['admin/components/AdminApplicationClient.jsx'], bundle: true, write: false, format: 'esm', jsx: 'automatic',
        plugins: [{ name: 'navigation-guard-unit', setup(builder) {
            builder.onResolve({ filter: /./ }, (args) => {
                if (!args.importer || args.path.endsWith('siteSettingsState.mjs')) return;
                return { path: args.path, namespace: 'unit' };
            });
            builder.onLoad({ filter: /./, namespace: 'unit' }, ({ path }) => {
                if (path === 'react') return { contents: 'export const {useCallback,useContext,useEffect,useMemo,useRef,useState} = globalThis.__kroyNavigationGuardTest;' };
                if (path === 'react/jsx-runtime') return { contents: 'export const jsx = (type,props) => ({type,props}); export const jsxs = jsx;' };
                return { contents: 'export default {Provider: "WorkspaceProvider"};' };
            });
        } }],
    });
    const { default: AdminApplication } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
    const tree = AdminApplication({ children: null });
    for (const effect of effects) cleanups.push(effect());
    const header = { isDirty: true, saveStatus: 'idle' };
    tree.props.value.registerHeader(header);
    const url = (path) => new URL(path, 'https://site.example.org');
    const settings = ['/admin/appearance', '/admin/contacts', '/admin/seo'];
    for (const type of ['navigate', 'popstate']) {
        for (const from of settings) {
            for (const to of settings) assert.equal(guard({ from: url(from), to: url(`${to}?test=1#field`), type }), true);
        }
    }
    assert.equal(prompts, 0);
    assert.equal(header.isDirty, true); // Exemption does not reset dirty/publication state.
    for (const type of ['navigate', 'popstate']) {
        for (const from of [...settings, '/admin/pages/page-id', '/admin/pages/page-id/settings', '/admin/pages/new']) {
            const transition = { from: url(from), to: url('/admin/materials'), type };
            confirmed = false;
            const before = prompts;
            assert.equal(guard(transition), false); // Cancelled: router must retain the current route.
            assert.equal(prompts, before + 1);
            confirmed = true;
            assert.equal(guard(transition), true);
        }
        confirmed = false;
        assert.equal(guard({ from: url('/admin/pages/page-id'), to: url('/admin/seo'), type }), false);
    }
    let prevented = false;
    const reloadEvent = { preventDefault() { prevented = true; } };
    listeners.get('beforeunload')(reloadEvent);
    assert.equal(prevented, true);
    assert.equal(reloadEvent.returnValue, '');
    tree.props.value.registerHeader({ isDirty: false });
    const before = prompts;
    for (const type of ['navigate', 'popstate']) assert.equal(guard({ from: url('/admin/seo'), to: url('/admin/materials'), type }), true);
    assert.equal(prompts, before);
    prevented = false;
    listeners.get('beforeunload')({ preventDefault() { prevented = true; } });
    assert.equal(prevented, false);
});
