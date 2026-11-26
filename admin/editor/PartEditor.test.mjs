import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { writeFile, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { JSDOM } from 'jsdom';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';

test('part tabs keep field instances and drafts, do not save, and reset for another block', async () => {
    const outfile = new URL(`.PartEditor-${randomUUID()}.mjs`, import.meta.url);
    const result = await build({
        entryPoints: [new URL('./PartEditor.jsx', import.meta.url).pathname],
        outfile: outfile.pathname, bundle: true, write: false, format: 'esm',
        platform: 'node', packages: 'external', jsx: 'automatic', loader: { '.svg': 'text' },
        plugins: [{
            name: 'field-isolation',
            setup(build) {
                build.onResolve({ filter: /^\.\/Field\.jsx$/ }, () => ({ path: 'field', namespace: 'unit' }));
                build.onLoad({ filter: /.*/, namespace: 'unit' }, () => ({
                    contents: `import {createElement} from 'react'; export default function Field({name, value, onChange}) {
                        return createElement('input', {'data-field':name, defaultValue:value, onChange:e=>onChange(e.target.value)});
                    }`,
                    resolveDir: new URL('../../', import.meta.url).pathname,
                }));
            },
        }],
    });
    const dom = new JSDOM('<div id="root"></div>');
    const previous = Object.fromEntries(['window', 'document', 'IS_REACT_ACT_ENVIRONMENT'].map((name) => [name, globalThis[name]]));
    let root;
    try {
        await writeFile(outfile, result.outputFiles.find(({ path }) => path.endsWith('.mjs')).contents);
        const { default: PartEditor } = await import(outfile.href);
        globalThis.window = dom.window;
        globalThis.document = dom.window.document;
        globalThis.IS_REACT_ACT_ENVIRONMENT = true;
        root = createRoot(document.getElementById('root'));
        const calls = [];
        const props = {
            title: 'Block', props: { title: 'Saved' }, fields: { title: { type: 'input' } },
            partContract: 'hero', view: { name: 'hero', props: {} },
            widgetMetadata: { hero: { contract: 'hero', title: 'Hero', fields: {} }, editorial: { contract: 'hero', title: 'Editorial', fields: {} } },
            onPropChange: (...args) => calls.push(args),
            onViewChange: (...args) => calls.push(args),
            onViewPropChange: (...args) => calls.push(args),
        };
        await act(() => root.render(createElement(PartEditor, { ...props, key: 'first' })));
        const tabs = () => [...document.querySelectorAll('nav button')];
        assert.deepEqual(tabs().map((button) => button.textContent), ['Данные', 'Виджет']);
        const input = document.querySelector('[data-field="title"]');
        input.value = 'Unsaved draft';
        await act(() => tabs()[1].click());
        assert.equal(input.closest('[hidden]') !== null, true);
        assert.equal(document.querySelector('select').options.length, 2);
        await act(() => tabs()[0].click());
        assert.equal(document.querySelector('[data-field="title"]'), input);
        assert.equal(input.value, 'Unsaved draft');
        assert.deepEqual(calls, []);
        await act(() => tabs()[1].click());
        await act(() => root.render(createElement(PartEditor, { ...props, key: 'second' })));
        assert.equal(document.querySelector('[data-field="title"]').closest('[hidden]'), null);
        await act(() => root.render(createElement(PartEditor, { ...props, key: 'empty', fields: {} })));
        assert.deepEqual(tabs().map((button) => button.textContent), ['Виджет']);
        const select = document.querySelector('select');
        assert.equal(select.closest('[hidden]'), null);
        await act(() => {
            select.value = 'editorial';
            select.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
        });
        assert.deepEqual(calls, [['editorial']]);
    } finally {
        if (root) await act(() => root.unmount());
        dom.window.close();
        for (const [name, value] of Object.entries(previous)) {
            if (value === undefined) delete globalThis[name];
            else globalThis[name] = value;
        }
        await rm(outfile, { force: true });
    }
});
