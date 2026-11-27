import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { transform } from '@svgr/core';
import { JSDOM } from 'jsdom';
import { act, createElement } from 'react';
import { LexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $createParagraphNode, $createTextNode, $getRoot, $getSelection, $setSelection, createEditor } from 'lexical';
import { registerRichText } from '@lexical/rich-text';
import { registerList } from '@lexical/list';
import { getRichTextNodes, registerFullTableTransforms } from '../../shared/lexicalEditor.mjs';
import { EXTERNAL_RICHTEXT_TAG } from './richTextState.mjs';

test('icon toolbar and table popup preserve selection, choose current context and exclude compact tables', async (t) => {
    const compiled = await build({
        entryPoints: [new URL('./RichTextEditor.jsx', import.meta.url).pathname],
        outfile: '/tmp/opencode/richtext-toolbar-dom.mjs', write: false, bundle: true, format: 'esm', platform: 'node', jsx: 'automatic',
        loader: { '.module.css': 'local-css' },
        plugins: [{
            name: 'external-packages', setup(builder) {
                builder.onResolve({ filter: /^[^./]/ }, ({ path }) => ({ path: import.meta.resolve(path), external: true }));
            },
        }, {
            name: 'svg', setup(builder) {
                builder.onLoad({ filter: /\.svg$/ }, async ({ path }) => ({
                    contents: await transform(await readFile(path, 'utf8'), { plugins: ['@svgr/plugin-jsx'] }), loader: 'jsx',
                }));
            },
        }],
    });
    const dom = new JSDOM('<!doctype html><div id="root"></div>');
    const globals = { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement,
        IS_REACT_ACT_ENVIRONMENT: true, ResizeObserver: class { observe() {} disconnect() {} } };
    const previous = Object.fromEntries(Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    const { createRoot } = await import('react-dom/client');
    const { RichTextToolbar } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles.find(({ path }) => path.endsWith('.mjs')).contents).toString('base64')}`);
    // jsdom has no top layer/layout; real Popover and sticky geometry are checked in Chrome.
    dom.window.HTMLElement.prototype.showPopover = function () { this.dataset.open = 'true'; this.style.display = 'block'; };
    dom.window.HTMLElement.prototype.hidePopover = function () { delete this.dataset.open; this.style.display = 'none'; };
    const root = createRoot(document.getElementById('root'));
    t.after(async () => {
        await act(() => root.unmount());
        for (const [key, descriptor] of Object.entries(previous)) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor);
            else delete globalThis[key];
        }
        dom.window.close();
    });
    const editor = createEditor({ nodes: getRichTextNodes('full'), onError: (error) => { throw error; } });
    t.after(registerRichText(editor));
    t.after(registerList(editor));
    t.after(registerFullTableTransforms(editor));
    editor.update(() => {
        $getRoot().append($createParagraphNode().append($createTextNode('Alpha')), $createParagraphNode().append($createTextNode('Outside')));
        $getRoot().getFirstDescendant().select(1, 4);
    }, { discrete: true });
    const render = (variant) => act(async () => {
        root.render(createElement(LexicalComposerContext.Provider, { value: [editor, { getTheme: () => null }] },
            createElement(RichTextToolbar, { variant })));
    });
    const click = (element) => act(async () => { element.click(); });
    const button = (label) => document.querySelector(`button[aria-label="${label}"]`);
    const menuItem = (label) => [...document.querySelectorAll('[popover] button')].find((item) => item.textContent.replace('✓', '') === label);
    const update = (callback) => act(() => editor.update(callback, { discrete: true }));
    await render('full');
    for (const item of document.querySelectorAll('[role="toolbar"] button')) {
        assert.equal(item.textContent, '');
        assert.ok(item.querySelector('svg'));
        assert.equal(item.querySelector('svg').getAttribute('width'), '16');
        assert.equal(item.querySelector('svg').getAttribute('height'), '16');
        assert.equal(item.title, item.getAttribute('aria-label'));
    }
    for (const label of ['Жирный', 'Курсив', 'Подчёркнутый']) {
        await click(button(label));
        assert.equal(button(label).getAttribute('aria-pressed'), 'true');
        editor.getEditorState().read(() => assert.equal($getSelection().getTextContent(), 'lph'));
        await click(button(label));
        assert.equal(button(label).getAttribute('aria-pressed'), 'false');
    }
    await click(button('Таблица'));
    assert.ok(document.querySelector('[role="dialog"][popover]'));
    assert.deepEqual([...document.querySelectorAll('[popover] input')].map((input) => input.value), ['2', '6']);
    assert.equal(document.activeElement.tagName, 'INPUT');
    await click(menuItem('Вставить'));
    assert.equal(document.querySelector('[popover]'), null);
    const tables = () => editor.getEditorState().toJSON().root.children.filter((node) => node.type === 'table');
    assert.equal(tables()[0].children.length, 2);
    assert.equal(tables()[0].children[0].children.length, 6);
    await click(button('Таблица'));
    assert.ok(document.querySelector('[role="menu"][popover]'));
    assert.equal(menuItem('Заголовочный столбец').getAttribute('aria-checked'), 'false');
    await click(menuItem('Заголовочный столбец'));
    assert.ok(tables()[0].children.every((row) => row.children[0].headerState === 2));
    await click(button('Таблица'));
    assert.equal(menuItem('Заголовочный столбец').getAttribute('aria-checked'), 'true');
    await click(menuItem('Вставить строку снизу'));
    assert.equal(tables()[0].children.length, 3);
    await update(() => $getRoot().getLastChild().selectStart());
    await click(button('Таблица'));
    assert.ok(document.querySelector('[role="dialog"][popover]'), 'a paragraph must not reuse the previous table context');
    await act(() => document.querySelector('[popover]').dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })));
    assert.equal(document.querySelector('[popover]'), null);
    assert.equal(document.activeElement, button('Таблица'));
    await act(async () => editor.update(() => {
        $getRoot().clear().append($createParagraphNode().append($createTextNode('Replacement')));
        $setSelection(null);
    }, { discrete: true, tag: EXTERNAL_RICHTEXT_TAG }));
    await click(button('Таблица'));
    assert.ok(document.querySelector('[role="dialog"][popover]'), 'external replacement must invalidate cached node keys');
    await act(async () => editor.update(() => {
        $getRoot().clear().append($createParagraphNode().append($createTextNode('Another document')));
        $setSelection(null);
    }, { discrete: true, tag: EXTERNAL_RICHTEXT_TAG }));
    assert.equal(document.querySelector('[popover]'), null, 'a popup must close when its document is replaced');
    await render('compact');
    assert.equal(button('Таблица'), null);
    assert.equal(button('Заголовок H2'), null);
    assert.ok(button('Маркированный список'));
});
