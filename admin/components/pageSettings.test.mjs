import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';

function descendants(element) {
    if (Array.isArray(element)) return element.flatMap(descendants);
    if (!element || typeof element !== 'object') return [];
    return [element, ...descendants(element.props?.children)];
}

// Exercise component event handlers and hook state without a browser or DOM library.
test('tree toggles are independent; settings submit SEO and clear dirty state only after saving', async (t) => {
    let cursor = 0;
    let cells = [];
    let effects = [];
    const runtime = {
        useState(initial) {
            const index = cursor++;
            if (!(index in cells)) cells[index] = initial;
            return [cells[index], (next) => { cells[index] = typeof next === 'function' ? next(cells[index]) : next; }];
        },
        useRef(initial) {
            const [ref] = runtime.useState({ current: initial });
            return ref;
        },
        useEffect(fn, deps) {
            const index = cursor++;
            if (!cells[index] || deps.some((value, i) => value !== cells[index][i])) effects.push(fn);
            cells[index] = deps;
        },
    };
    globalThis.__kroyPageSettingsTest = runtime;
    const previousFrame = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = () => 0;
    t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({}) }));
    t.after(() => {
        delete globalThis.__kroyPageSettingsTest;
        if (previousFrame === undefined) delete globalThis.requestAnimationFrame;
        else globalThis.requestAnimationFrame = previousFrame;
    });
    const compiled = await build({
        stdin: { contents: `export { default as PageList } from './admin/components/PageList.jsx';
            export { default as PageDetailsForm } from './admin/components/PageDetailsForm.jsx';`, resolveDir: process.cwd() },
        bundle: true, write: false, format: 'esm', jsx: 'automatic',
        plugins: [{ name: 'page-component-unit', setup(builder) {
            builder.onResolve({ filter: /^(react|react\/jsx-runtime)$|\/(Button|Icon|ValidatedForm|Tabs|SeoFields)\.jsx$|\.module\.css$|\/(apiRequest|formValidation)\.mjs$/ }, ({ path }) => ({ path, namespace: 'unit' }));
            builder.onLoad({ filter: /./, namespace: 'unit' }, ({ path }) => {
                if (path === 'react') return { contents: 'export const { useState, useRef, useEffect } = globalThis.__kroyPageSettingsTest;' };
                if (path === 'react/jsx-runtime') return { contents: 'export const jsx = (type,props) => ({type,props}); export const jsxs = jsx; export const Fragment = "fragment";' };
                if (path.endsWith('apiRequest.mjs')) return { contents: 'export const apiRequest = (...args) => globalThis.__kroyPageSettingsTest.request(...args);' };
                if (path.endsWith('formValidation.mjs')) return { contents: 'export const fieldValidationMessage = () => ""; export const formResponseError = async () => "Ошибка";' };
                if (path.endsWith('.css')) return { contents: 'export default { expandedChevron: "expandedChevron" };' };
                return { contents: `export default ${JSON.stringify(path.split('/').at(-1).replace('.jsx', ''))};` };
            });
        } }],
    });
    const { PageList, PageDetailsForm } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
    function render(component, props) {
        cursor = 0;
        effects = [];
        const tree = component(props);
        for (const effect of effects) effect();
        return descendants(tree);
    }
    const pages = [{ id: 'a', title: 'A', path: '/a', redirects: ['/old'] }, { id: 'b', title: 'B', path: '/a/b' }];
    let tree = render(PageList, { pages });
    const branch = (tree, label) => tree.find(({ props }) => props['aria-label']?.startsWith(label));
    const assertChevron = (button, expanded) => {
        assert.equal(button.props['aria-expanded'], expanded);
        assert.equal(button.props.children.type, 'Icon');
        assert.equal(button.props.children.props.name, 'chevronRight');
        assert.equal(button.props.children.props.className, expanded ? 'expandedChevron' : '');
    };
    assert.match(await readFile(new URL('./PageList.module.css', import.meta.url), 'utf8'), /\.expandedChevron\s*\{\s*transform:\s*rotate\(90deg\)/);
    assertChevron(branch(tree, 'Дочерние'), true);
    tree.find(({ props }) => props['aria-label']?.startsWith('Перенаправления')).props.onClick();
    tree = render(PageList, { pages });
    assertChevron(branch(tree, 'Дочерние'), true);
    assert.ok(tree.some(({ props }) => Array.isArray(props.children) && props.children.join('') === '↪ /old'));
    tree.find(({ props }) => props['aria-label']?.startsWith('Дочерние')).props.onClick();
    tree = render(PageList, { pages });
    assertChevron(branch(tree, 'Дочерние'), false);
    assert.ok(tree.some(({ props }) => Array.isArray(props.children) && props.children.join('') === '↪ /old'));
    assert.ok(!tree.some(({ props }) => props.href === '/admin/pages/b'));
    tree.find(({ props }) => props['aria-label']?.startsWith('Дочерние')).props.onClick();
    tree = render(PageList, { pages });
    assert.ok(tree.some(({ props }) => props.href === '/admin/pages/b'));

    cells = [];
    tree = render(PageList, { pages: [pages[1]] });
    assertChevron(branch(tree, 'Ветка'), true);
    branch(tree, 'Ветка').props.onClick();
    tree = render(PageList, { pages: [pages[1]] });
    assertChevron(branch(tree, 'Ветка'), false);

    cells = [];
    let dirty;
    let saveStatus;
    let saved;
    let request;
    const props = {
        page: { id: 'a', title: 'A', path: '/a', type: 'standard', seo: { description: 'Preserved' } },
        hideActions: true, handleEscape: false,
        onDirtyChange: (value) => { dirty = value; },
        onSaveStatusChange: (value) => { saveStatus = value; },
        onSaved: (value) => { saved = value; },
    };
    tree = render(PageDetailsForm, props);
    assert.equal(dirty, false);
    tree.find(({ type }) => type === 'SeoFields').props.onChange({ description: 'Edited SEO' });
    tree = render(PageDetailsForm, props);
    assert.equal(dirty, true);
    runtime.request = async (url, options) => {
        request = { url, method: options.method, body: JSON.parse(options.body) };
        return { ok: true, json: async () => ({ ...props.page, seo: request.body.seo }) };
    };
    await tree.find(({ type }) => type === 'ValidatedForm').props.onSubmit({ preventDefault() {}, currentTarget: {} });
    assert.deepEqual(request, { url: '/api/pages/a', method: 'PATCH', body: { title: 'A', path: '/a', seo: { description: 'Edited SEO' } } });
    render(PageDetailsForm, { ...props, page: saved });
    assert.equal(dirty, false);
    assert.equal(saveStatus, 'success');
});
