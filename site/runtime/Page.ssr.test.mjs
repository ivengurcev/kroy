import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { randomUUID } from 'node:crypto';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { transform } from 'esbuild';

let Page;
let compiledPath;
before(async () => {
    const sourcePath = fileURLToPath(new URL('./Page.jsx', import.meta.url));
    const { code } = await transform(await readFile(sourcePath, 'utf8'), { loader: 'jsx', format: 'esm', jsx: 'automatic' });
    compiledPath = join(dirname(sourcePath), `.Page-test-${randomUUID()}.mjs`);
    await writeFile(compiledPath, code);
    ({ default: Page } = await import(pathToFileURL(compiledPath).href));
});
after(async () => { if (compiledPath) await rm(compiledPath, { force: true }); });

test('calls the data part with independent settings, record, context and site data, then renders its widget', () => {
    const props = { title: 'setting' };
    const record = { title: 'record' };
    const context = { params: { caseId: 'sample' } };
    const contacts = { phone: '+70000000000' };
    const catalog = { products: [] };
    const reviews = [{ id: 'review' }];
    const materials = { section: { items: [] } };
    const materialSectionId = 'section';
    const options = { layout: 'wide' };
    function prepare(input) {
        assert.deepEqual(input, { props, record, context, contacts, catalog, reviews, materials, materialSectionId });
        return { title: `${input.props.title}|${input.record.title}` };
    }
    function Widget(input) {
        assert.deepEqual(Object.keys(input).sort(), ['context', 'data', 'options']);
        assert.equal(input.context, context);
        assert.equal(input.options, options);
        return createElement('output', null, `${input.data.title}|${input.options.layout}|${input.context.params.caseId}`);
    }
    assert.equal(renderToStaticMarkup(createElement(Page, {
        content: [{ part: '@kroy/example', props, view: { name: '@kroy/view', props: options } }],
        parts: { '@kroy/example': prepare }, widgets: { '@kroy/view': Widget },
        record, context, contacts, catalog, reviews, materials, materialSectionId,
    })), '<output>setting|record|wide|sample</output>');
});

test('requires a known data part and a selected known widget', () => {
    const item = { part: '@kroy/example', props: {}, view: { name: '@kroy/view', props: {} } };
    const props = { content: [item], parts: { '@kroy/example': () => ({}) }, widgets: { '@kroy/view': () => null } };
    for (const [overrides, message] of [
        [{ parts: {} }, /Запчасть не найдена/],
        [{ widgets: {} }, /Виджет не найден/],
        [{ content: [{ part: item.part, props: {} }] }, /виджет/i],
    ]) {
        assert.throws(() => renderToStaticMarkup(createElement(Page, { ...props, ...overrides })), message);
    }
});

test('supplies empty route context and null record when rendering a standard page', () => {
    function prepare({ context, record }) {
        assert.deepEqual(context, { params: {} });
        assert.equal(record, null);
        return { title: 'Standard page' };
    }
    function Widget({ data }) { return createElement('p', null, data.title); }
    assert.equal(renderToStaticMarkup(createElement(Page, {
        content: [{ part: '@kroy/standard', props: {}, view: { name: '@kroy/view', props: {} } }],
        parts: { '@kroy/standard': prepare }, widgets: { '@kroy/view': Widget },
    })), '<p>Standard page</p>');
});
