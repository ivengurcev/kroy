import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { rm, writeFile } from 'node:fs/promises';
import test from 'node:test';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';

test('page and template editors save and cancel the shared footer in their document transaction', async (t) => {
    const file = new URL(`.editor-test-${randomUUID()}.mjs`, import.meta.url);
    const result = await build({
        entryPoints: ['admin/editor/Editor.jsx'], bundle: true, write: false, platform: 'node', format: 'esm',
        outfile: file.pathname, jsx: 'automatic',
        external: ['react', 'react/jsx-runtime'],
        plugins: [{ name: 'isolate-editor-io', setup(builder) {
            builder.onResolve({ filter: /AdminShell\.jsx$|@vyaz\/core\/Context\.js$|\/dist\/kroy\/.*\.mjs$/ },
                ({ path }) => ({ path, namespace: 'editor-stub' }));
            builder.onLoad({ filter: /.*/, namespace: 'editor-stub' }, ({ path }) => ({
                contents: path.endsWith('AdminShell.jsx') ? 'export default (props) => (globalThis.__editor = props, null);'
                    : path.endsWith('Context.js') ? 'import { createContext } from "react"; export default createContext(globalThis.__editorRoute);'
                        : 'export const parts = {}; export const widgets = {};',
                resolveDir: process.cwd(),
            }));
        } }],
    });
    await writeFile(file, result.outputFiles[0].contents);
    t.after(() => rm(file, { force: true }));
    const dom = new JSDOM('<div id="root"></div>');
    for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, Event: dom.window.Event, IS_REACT_ACT_ENVIRONMENT: true })) {
        const previous = Object.getOwnPropertyDescriptor(globalThis, key);
        Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
        t.after(() => previous ? Object.defineProperty(globalThis, key, previous) : delete globalThis[key]);
    }
    t.after(() => { dom.window.close(); delete globalThis.__editor; delete globalThis.__editorRoute; });
    const heading = { part: '@kroy/header', props: { title: 'Before', navigation: [] }, view: { name: '@kroy/header', props: {} } };
    const layout = { id: 'layout', name: 'Основной', slotIndex: 1, content: [heading], version: 2 };
    const settings = { site: { id: 'site', name: 'Название' }, contacts: {}, domains: [], footer: { props: { description: 'Saved' }, version: 3 } };
    const writes = [];
    let fail = true;
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        const reply = (data) => ({ ok: true, json: async () => data });
        if (options?.method === 'PUT') {
            const payload = JSON.parse(options.body);
            writes.push({ url, payload });
            if (fail) return { ok: false, status: 409, json: async () => ({ code: 'footer_conflict', error: 'Конфликт' }) };
            return reply({ ...layout, footer: { props: payload.footerChanges.props, version: 4 } });
        }
        if (url === '/api/site/settings') return reply(settings);
        if (url === '/api/templates/layout') return reply(layout);
        if (url === '/api/templates') return reply({ templates: [layout], defaultTemplateId: layout.id });
        if (url === '/api/pages/page') return reply({ id: 'page', title: 'Page', path: '/page', content: [], effectiveTemplateId: layout.id });
        if (url === '/api/site/preview') return reply({});
        return reply([]);
    });
    const shell = () => globalThis.__editor;
    for (const isTemplate of [false, true]) {
        globalThis.__editorRoute = { pathname: isTemplate ? '/admin/templates/layout' : '/admin/pages/page' };
        const { default: Editor } = await import(`${file.href}?template=${isTemplate}`);
        const root = createRoot(document.getElementById('root'));
        try {
            await act(async () => { root.render(createElement(Editor)); });
            assert.equal(shell().loadStatus, 'success');
            assert.equal(shell().footer.props.description, 'Saved');
            assert.equal(shell().isDirty, false);
            await act(() => shell().workspaceSettings.onFooterChange({ description: 'Discard' }));
            assert.equal(shell().isDirty, true);
            const beforeCancel = writes.length;
            await act(() => shell().onCancel());
            assert.equal(writes.length, beforeCancel);
            assert.equal(shell().footer.props.description, 'Saved');
            assert.equal(shell().isDirty, false);
            await act(() => shell().workspaceSettings.onFooterChange({ description: 'New footer' }));
            if (!isTemplate) {
                const settings = () => shell().pageContentSettings;
                assert.equal(shell().editorSettings, undefined);
                assert.deepEqual(settings().layoutList.templates.map(({ id }) => id), ['layout']);
                await act(() => settings().onTemplateChange('none'));
                assert.equal(settings().template, 'none');
                assert.equal(shell().workspaceSettings.sharedBefore, undefined);
                assert.equal(shell().footer.props.description, 'New footer');
                await act(() => settings().onTemplateChange('inherit'));
                assert.equal(settings().template, 'inherit');
            }
            if (isTemplate) {
                const block = shell().content[0];
                await act(() => shell().onMovePart(block.id, 1));
                assert.equal(shell().content[0].slot, true);
            } else {
                const block = shell().workspaceSettings.sharedBefore[0];
                await act(() => shell().workspaceSettings.onSharedPropChange(block.id, 'title', 'New headline'));
            }
            await act(() => shell().onSave());
            assert.deepEqual(writes.at(-1).payload.footerChanges, { expectedVersion: 3, props: { description: 'New footer' } });
            if (isTemplate) {
                assert.equal(writes.at(-1).payload.slotIndex, 0);
                assert.equal(writes.at(-1).payload.content.length, 1);
                assert.equal(shell().isDirty, false);
            } else {
                assert.equal(writes.at(-1).payload.templateChanges.propsByIndex[0].title, 'New headline');
                assert.equal(writes.at(-1).payload.content, undefined);
                assert.equal(shell().isDirty, true);
                assert.equal(shell().footer.props.description, 'New footer');
                fail = false;
            }
        } finally {
            await act(() => root.unmount());
        }
    }
});
