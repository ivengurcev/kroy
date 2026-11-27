import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { isDocumentText } from '../../shared/legalDocuments.mjs';
import { toLexicalDocument } from '../ui/richTextState.mjs';
import { readApiError } from './apiRequest.mjs';

function nodes(element) {
    if (Array.isArray(element)) return element.flatMap(nodes);
    if (!element || typeof element !== 'object') return [];
    if (typeof element.type === 'function') return nodes(element.type(element.props));
    return [element, ...nodes(element.props?.children)];
}

test('page editor toggles legal purpose in its draft without locking ordinary block operations', async (t) => {
    let cursor = 0;
    const cells = [];
    let effects = [];
    const runtime = {
        useState(initial) {
            const index = cursor++;
            if (!(index in cells)) cells[index] = typeof initial === 'function' ? initial() : initial;
            return [cells[index], (value) => { cells[index] = typeof value === 'function' ? value(cells[index]) : value; }];
        },
        useRef(initial) { return runtime.useState({ current: initial })[0]; },
        useEffect(fn, deps) {
            const index = cursor++;
            if (!cells[index] || deps.some((value, i) => value !== cells[index][i])) effects.push(fn);
            cells[index] = deps;
        },
        useCallback(fn) { return fn; },
        useMemo(fn) { return fn(); },
        useContext() { return { pathname: '/admin/pages/page' }; },
    };
    globalThis.__kroyLegalEditorTest = runtime;
    t.after(() => { delete globalThis.__kroyLegalEditorTest; });
    let stored = {
        id: 'page', type: 'standard', title: 'Обычная', path: '/page', content: [],
        isLegalDocument: false, legalVersion: '1',
    };
    const footer = { props: { description: 'Saved footer' }, version: 1 };
    t.mock.method(globalThis, 'fetch', async (url) => ({
        ok: true, json: async () => url === '/api/pages/page' ? stored : url === '/api/pages' ? [stored]
            : url === '/api/templates' ? { templates: [], defaultTemplateId: null }
                : url === '/api/site/settings' ? { site: { id: 'site', name: 'Site' }, footer, contacts: {} }
                    : { pages: {}, materialSections: [] },
    }));
    let request;
    let failure;
    runtime.readApiError = readApiError;
    runtime.request = async (url, options) => {
        request = JSON.parse(options.body);
        if (failure === 'network') throw new TypeError('Failed to fetch');
        if (failure) return { ok: false, status: failure, json: async () => ({
            error: failure === 400 ? 'Проверьте содержимое страницы' : 'Save failed',
            ...(failure === 409 ? { code: 'legal_document_conflict' } : {}),
        }) };
        stored = { ...stored, content: request.content ?? stored.content,
            isLegalDocument: request.isLegalDocument ?? stored.isLegalDocument, legalVersion: String(Number(stored.legalVersion) + 1) };
        return { ok: true, json: async () => ({ ...stored, ...(request.footerChanges ? {
            footer: { props: request.footerChanges.props, version: request.footerChanges.expectedVersion + 1 },
        } : {}) }) };
    };
    const compiled = await build({
        entryPoints: ['admin/editor/Editor.jsx'], bundle: true, write: false, format: 'esm', jsx: 'automatic',
        plugins: [{ name: 'legal-editor-unit', setup(builder) {
            builder.onResolve({ filter: /^react$|^react\/jsx-runtime$|^@vyaz\/core\/Context\.js$|\/(AdminShell|Button|FormField)\.jsx$|\.module\.css$|dist\/kroy\/(parts|widgets)\.mjs$|\/apiRequest\.mjs$/ },
                ({ path }) => ({ path, namespace: 'unit' }));
            builder.onLoad({ filter: /./, namespace: 'unit' }, ({ path }) => {
                if (path === 'react') return { contents: 'export const {useState,useRef,useEffect,useCallback,useMemo,useContext} = globalThis.__kroyLegalEditorTest;' };
                if (path === 'react/jsx-runtime') return { contents: 'export const Fragment="fragment"; export const jsx=(type,props)=>({type,props}); export const jsxs=jsx;' };
                if (path.endsWith('parts.mjs')) return { contents: 'export const parts={};' };
                if (path.endsWith('widgets.mjs')) return { contents: 'export const widgets={};' };
                if (path.endsWith('apiRequest.mjs')) return { contents: 'export const apiRequest=(...args)=>globalThis.__kroyLegalEditorTest.request(...args); export const readApiError=(...args)=>globalThis.__kroyLegalEditorTest.readApiError(...args);' };
                return { contents: `export default ${JSON.stringify(path.endsWith('.css') || path.includes('Context') ? {} : path.split('/').at(-1).replace('.jsx', ''))};` };
            });
        } }],
    });
    const { default: Editor } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
    function render() {
        cursor = 0;
        effects = [];
        const tree = nodes(Editor());
        for (const effect of effects) effect();
        const shell = tree.find(({ type }) => type === 'AdminShell').props;
        return { ...shell, toggle: nodes(shell.editorSettings).find(({ type }) => type === 'input')?.props.onChange };
    }
    render();
    await new Promise(setImmediate);
    let editor = render();
    assert.equal(editor.loadStatus, 'success');
    editor.onAddPart('@kroy/text', 0);
    editor = render();
    const ordinary = editor.content[0];
    editor.toggle({ target: { checked: true } });
    editor = render();
    const first = editor.content[1];
    assert.equal(editor.workspaceSettings.isLegalDocument, true);
    assert.equal(isDocumentText(first.props.content), true);
    assert.equal(editor.content[0], ordinary);
    editor.onRemovePart(first.id);
    editor = render();
    assert.equal(editor.content.length, 2);
    editor.onAddPart('@kroy/document', 2);
    editor = render();
    const additional = editor.content[2];
    editor.onRemovePart(additional.id);
    editor = render();
    assert.equal(editor.content.length, 2);
    editor.onMovePart(first.id, -1);
    editor = render();
    assert.equal(editor.content[0], first);
    const text = toLexicalDocument('Изменённый текст');
    editor.onPropChange(first.id, 'content', text);
    editor = render();
    assert.equal(editor.content[0].props.content, text);
    editor.onRemovePart(ordinary.id);
    assert.equal(render().content.length, 1);
    editor = render();
    editor.toggle({ target: { checked: false } });
    editor = render();
    const disabledContent = editor.content;
    editor.toggle({ target: { checked: true } });
    editor = render();
    assert.equal(editor.content, disabledContent);
    editor.onCancel();
    editor = render();
    assert.equal(editor.workspaceSettings.isLegalDocument, false);
    assert.deepEqual(editor.content, []);
    assert.equal(editor.isDirty, false);
    editor.toggle({ target: { checked: true } });
    editor = render();
    await editor.onSave();
    assert.equal(request.isLegalDocument, true);
    assert.equal(request.expectedLegalVersion, '1');
    assert.equal(stored.content[0].part, '@kroy/document');
    editor = render();
    assert.equal(editor.isDirty, false);
    editor.toggle({ target: { checked: false } });
    editor = render();
    await editor.onSave();
    assert.equal(stored.isLegalDocument, false);
    assert.equal(stored.content.length, 1);
    assert.equal(request.expectedLegalVersion, '2');
    editor = render();
    editor.onRemovePart(editor.content[0].id);
    assert.deepEqual(render().content, []);
    editor = render();
    editor.onCancel();
    editor = render();
    editor.onAddPart('@kroy/document', 1);
    editor = render();
    const formerFirst = editor.content[0];
    const formerSecond = editor.content[1];
    editor.toggle({ target: { checked: true } });
    editor = render();
    assert.equal(editor.content.length, 2);
    editor.onMovePart(formerFirst.id, 1);
    editor = render();
    editor.onRemovePart(formerSecond.id);
    editor = render();
    assert.equal(editor.content.length, 2);
    editor.onRemovePart(formerFirst.id);
    editor = render();
    assert.equal(editor.content.length, 1);
    await editor.onSave();
    editor = render();
    const beforeModal = stored.legalVersion;
    editor.toggle({ target: { checked: false } });
    editor = render();
    const footerDraft = { description: 'Unsaved footer' };
    editor.workspaceSettings.onFooterChange(footerDraft);
    editor = render();
    const parentContent = editor.content;
    const updated = { ...stored, legalVersion: '100', content: [{
        ...stored.content[0], props: { content: toLexicalDocument('Из футера') },
    }] };
    editor.workspaceSettings.legalDocumentActions.onSaved(updated);
    editor = render();
    assert.equal(editor.workspaceSettings.isLegalDocument, false);
    assert.equal(editor.content, parentContent);
    assert.equal(editor.footer.props, footerDraft);
    await editor.onSave();
    assert.equal(request.expectedLegalVersion, beforeModal);
    assert.equal(request.footerChanges.props.description, footerDraft.description);

    for (const status of [400, 500, 'network']) {
        editor = render();
        editor.onPropChange(editor.content[0].id, 'content', toLexicalDocument(`Черновик ${status}`));
        editor = render();
        const draft = editor.content;
        failure = status;
        await editor.onSave();
        editor = render();
        assert.equal(editor.saveStatus, 'error');
        assert.equal(editor.isDirty, true);
        assert.equal(editor.content, draft);
        assert.equal(editor.notice.variant, 'error');
        assert.equal(editor.saveBlocked, false);
        assert.match(editor.notice.message, status === 400 ? /Проверьте/ : status === 500 ? /HTTP 500/ : /ошибки связи/);
        failure = null;
        await editor.onSave();
        editor = render();
        assert.equal(editor.saveStatus, 'success');
        assert.equal(editor.isDirty, false);
        assert.equal(editor.notice, null);
    }
    editor.onPropChange(editor.content[0].id, 'content', toLexicalDocument('Конфликтующий черновик'));
    editor = render();
    const conflictFooter = { description: 'Другие несохранённые настройки футера' };
    editor.workspaceSettings.onFooterChange(conflictFooter);
    editor = render();
    failure = 409;
    await editor.onSave();
    editor = render();
    const conflictDraft = editor.content;
    assert.equal(editor.saveBlocked, true);
    assert.equal(editor.notice.action.label, 'Загрузить актуальные данные');
    assert.equal(editor.content, conflictDraft);
    const previousWindow = globalThis.window;
    t.after(() => { if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow; });
    globalThis.window = { confirm: () => false };
    await editor.notice.action.onClick();
    editor = render();
    assert.equal(editor.content, conflictDraft);
    globalThis.window.confirm = () => true;
    await editor.notice.action.onClick();
    editor = render();
    assert.equal(editor.saveBlocked, false);
    assert.equal(editor.notice, null);
    assert.equal(editor.footer.props, conflictFooter);
    assert.equal(editor.isDirty, true);
});
