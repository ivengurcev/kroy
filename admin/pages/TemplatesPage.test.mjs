import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';

test('template list creates in a modal, preserves the draft on failure and protects the main row', async (t) => {
    const state = [];
    const effects = [];
    let cursor = 0;
    let destination;
    const requests = [];
    let resolveCreate;
    globalThis.__templatesPageTest = {
        useState(initial) {
            const index = cursor++;
            if (!(index in state)) state[index] = initial;
            return [state[index], (value) => { state[index] = typeof value === 'function' ? value(state[index]) : value; }];
        },
        useEffect(callback) { if (!effects.length) effects.push(callback); },
        navigate(path) { destination = path; },
    };
    const previousWindow = globalThis.window;
    globalThis.window = { confirm: () => true, dispatchEvent() {} };
    t.after(() => {
        delete globalThis.__templatesPageTest;
        if (previousWindow === undefined) delete globalThis.window;
        else globalThis.window = previousWindow;
    });
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        if (options?.method) requests.push({ url, method: options.method, body: options.body });
        if (options?.method === 'POST') return new Promise((resolve) => { resolveCreate = resolve; });
        if (options?.method === 'DELETE') return { ok: true, status: 204 };
        return { ok: true, json: async () => ({
            defaultTemplateId: 'main',
            templates: [
                { id: 'main', name: 'Основной', isMain: true, explicit: 0, inherited: 1, deleted: 0 },
                { id: 'extra', name: 'Дополнительный', explicit: 0, inherited: 0, deleted: 0 },
            ],
        }) };
    });
    const { outputFiles: [output] } = await build({
        entryPoints: ['admin/pages/TemplatesPage.jsx'], bundle: true, write: false, format: 'esm', jsx: 'automatic',
        plugins: [{ name: 'template-page-components', setup(builder) {
            builder.onResolve({ filter: /^(react|react\/jsx-runtime)$|\.jsx$|\.css$/ }, ({ path, importer }) =>
                importer ? { path, namespace: 'component' } : undefined);
            builder.onLoad({ filter: /./, namespace: 'component' }, ({ path }) => {
                if (path === 'react') return { contents: 'export const {useState,useEffect} = globalThis.__templatesPageTest;' };
                if (path === 'react/jsx-runtime') return { contents: 'export const Fragment = "fragment"; export const jsx = (type, props) => ({ type, props }); export const jsxs = jsx;' };
                if (path.endsWith('AdminWorkspaceContext.jsx')) return { contents: 'export const useAppNavigate = () => globalThis.__templatesPageTest.navigate;' };
                if (path.endsWith('AdminList.jsx')) return { contents: 'export const AdminListToolbar = "AdminListToolbar";' };
                if (path.endsWith('Tree.jsx')) return { contents: 'export const TreeEmpty = "TreeEmpty", TreeItem = "TreeItem"; export default "Tree";' };
                const name = path.split('/').at(-1).replace('.jsx', '');
                return { contents: `export default ${JSON.stringify(path.endsWith('.css') ? {} : name)};` };
            });
        } }],
    });
    const { default: TemplatesPage } = await import(`data:text/javascript;base64,${Buffer.from(output.text).toString('base64')}`);
    function render() { cursor = 0; return TemplatesPage(); }
    function find(node, predicate) {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) return node.map((child) => find(child, predicate)).find(Boolean);
        return predicate(node) ? node : find(node.props.children, predicate);
    }
    const component = (type) => find(render(), (node) => node.type === type);
    const submit = () => component('ValidatedForm').props.onSubmit({ preventDefault() {}, currentTarget: {} });

    assert.equal(render().props.status, 'loading');
    t.after(effects[0]());
    await new Promise(setImmediate);
    assert.equal(component('Modal'), undefined);
    assert.equal(find(render(), ({ props }) => props['aria-label'] === 'Удалить шаблон «Основной»'), undefined);
    const deleteExtra = () => find(component('Tree'), ({ type, props }) => type === 'TreeItem' && props.href.endsWith('/extra')).props.actions.props.children[1];
    await deleteExtra().props.onClick();
    assert.deepEqual(requests.shift(), { url: '/api/templates/extra', method: 'DELETE', body: undefined });
    assert.equal(find(component('Tree'), ({ type, props }) => type === 'TreeItem' && props.href.endsWith('/extra')), undefined);

    component('AdminListToolbar').props.actions.props.onClick();
    const input = () => component('input');
    input().props.onChange({ target: { value: 'Новый' } });
    const failure = submit();
    assert.equal(component('Modal').props.busy, true);
    assert.ok(component('Modal').props.actions.props.children.every(({ props }) => props.disabled));
    await submit();
    assert.equal(requests.length, 1);
    resolveCreate({ ok: false, status: 409, json: async () => ({}) });
    await failure;
    assert.equal(input().props.value, 'Новый');
    assert.equal(find(component('Modal'), ({ props }) => props.role === 'alert').props.children, 'Не удалось создать шаблон.');
    const success = submit();
    resolveCreate({ ok: true, json: async () => ({ id: 'new' }) });
    await success;
    assert.equal(component('Modal'), undefined);
    assert.equal(destination, '/admin/templates/new');
});
