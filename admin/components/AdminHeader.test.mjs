import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';

function nodes(element) {
    if (Array.isArray(element)) return element.flatMap(nodes);
    if (!element || typeof element !== 'object') return [];
    if (typeof element.type === 'function') return nodes(element.type(element.props));
    return [element, ...nodes(element.props?.children)];
}

test('header notices remain visible, dismiss independently, and retain conflict actions', async (t) => {
    let cursor = 0;
    const cells = [];
    let effects = [];
    const runtime = {
        useState(initial) {
            const index = cursor++;
            if (!(index in cells)) cells[index] = initial;
            return [cells[index], (value) => { cells[index] = value; }];
        },
        useRef(initial) {
            const index = cursor++;
            if (!(index in cells)) cells[index] = { current: initial };
            return cells[index];
        },
        useEffect(fn, deps) {
            const index = cursor++;
            if (!cells[index] || deps.some((value, i) => value !== cells[index][i])) effects.push(fn);
            cells[index] = deps;
        },
    };
    globalThis.__kroyHeaderTest = runtime;
    const previousWindow = globalThis.window;
    const listeners = new Map();
    const timeouts = [];
    globalThis.window = {
        matchMedia: () => ({ matches: false }),
        addEventListener: (event, fn) => listeners.set(event, fn),
        removeEventListener() {},
        setInterval: () => 1, clearInterval() {},
        setTimeout: (fn) => { timeouts.push(fn); return 1; }, clearTimeout() {},
    };
    t.after(() => {
        delete globalThis.__kroyHeaderTest;
        if (previousWindow === undefined) delete globalThis.window;
        else globalThis.window = previousWindow;
    });
    let publicationFails = false;
    t.mock.method(globalThis, 'fetch', async () => ({
        ok: !publicationFails, json: async () => ({ status: 'idle', hasChanges: false }),
    }));
    const compiled = await build({
        entryPoints: ['admin/components/AdminHeader.jsx'], bundle: true, write: false, format: 'esm', jsx: 'automatic',
        plugins: [{ name: 'header-unit', setup(builder) {
            builder.onResolve({ filter: /^react$|^react\/jsx-runtime$|\/(Button|Icon|AdminPageHeader)\.jsx$|\.module\.css$|\.svg$/ },
                ({ path }) => ({ path, namespace: 'unit' }));
            builder.onLoad({ filter: /./, namespace: 'unit' }, ({ path }) => {
                if (path === 'react') return { contents: 'export const {useState,useRef,useEffect} = globalThis.__kroyHeaderTest;' };
                if (path === 'react/jsx-runtime') return { contents: 'export const Fragment="fragment"; export const jsx=(type,props)=>({type,props}); export const jsxs=jsx;' };
                return { contents: `export default ${JSON.stringify(path.endsWith('.css') ? {} : path.split('/').at(-1).replace(/\.(jsx|svg)$/, ''))};` };
            });
        } }],
    });
    const { default: Header } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
    let actions = 0;
    const id = {};
    let notice = { id, variant: 'error', message: 'Конфликт сохранения', action: { label: 'Загрузить актуальные данные', onClick: () => actions++ } };
    function render() {
        cursor = 0;
        effects = [];
        const tree = nodes(Header({ notice }));
        for (const fn of effects) fn();
        return tree;
    }
    const text = (tree, message) => tree.find(({ props }) => props.children === message);
    const close = (tree) => tree.filter(({ props }) => props['aria-label'] === 'Закрыть уведомление');
    let tree = render();
    await new Promise(setImmediate);
    tree = render();
    assert.equal(text(tree, notice.message).props.role, 'alert');
    assert.equal(timeouts.length, 0);
    text(tree, notice.action.label).props.onClick();
    assert.equal(actions, 1);
    close(tree)[0].props.onClick();
    notice = { ...notice, action: { ...notice.action, disabled: true } };
    tree = render();
    assert.equal(text(tree, notice.message), undefined);
    notice = { ...notice, id: {}, action: { ...notice.action, disabled: false } };
    tree = render();
    assert.ok(text(tree, notice.message));
    publicationFails = true;
    await listeners.get('focus')();
    render();
    tree = render();
    assert.equal(close(tree).length, 2);
    publicationFails = false;
    await listeners.get('focus')();
    tree = render();
    assert.equal(close(tree).length, 2, 'background recovery must not dismiss unread errors');
    close(tree)[0].props.onClick();
    tree = render();
    assert.equal(close(tree).length, 1);
    close(tree)[0].props.onClick();
    assert.equal(close(render()).length, 0);
    notice = { id: {}, variant: 'info', message: 'Общее сообщение' };
    tree = render();
    assert.equal(text(tree, notice.message).props.role, 'status');
    assert.equal(close(tree).length, 1);
    assert.equal(timeouts.length, 0);
});
