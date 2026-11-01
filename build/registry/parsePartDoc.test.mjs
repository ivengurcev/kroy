import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePartDoc } from './parsePartDoc.mjs';

const source = (annotation) => `/**
 * @kroy-title Материал
 * @kroy-contract article
 * ${annotation}
 */
export default function prepareMaterial() { return {}; }`;

test('reads a default widget identifier separately from contract and fields', () => {
    const metadata = parsePartDoc(source('@kroy-default-widget @kroy/material-content'));
    assert.equal(metadata.defaultWidget, '@kroy/material-content');
    assert.equal(metadata.contract, 'article');
    assert.deepEqual(metadata.fields, {});
});

test('rejects empty default widget annotations', () => {
    assert.throws(() => parsePartDoc(source('@kroy-default-widget')), /default-widget/);
});

test('reads widget option defaults and validates their bounds', () => {
    const doc = `/**
     * @kroy-contract reviews
     * @param {number} [props.columns=3] - Колонки
     * @kroy columns widget=number min=1 max=4
     */
    export default function Widget() {}`;
    assert.equal(parsePartDoc(doc).fields.columns.default, 3);
    assert.throws(() => parsePartDoc(doc.replace('columns=3', 'columns=5')), /диапазона/);
});

test('reads string and boolean widget defaults from JSDoc', () => {
    const doc = `/**
     * @param {boolean} [props.autoplay=true] - Автопрокрутка
     * @param {'left'|'right'} [props.align='right'] - Выравнивание
     * @param {string} [props.label="Read more"] - Подпись
     */
    export default function Widget() {}`;
    const { fields } = parsePartDoc(doc);
    assert.equal(fields.autoplay.default, true);
    assert.equal(fields.align.default, 'right');
    assert.equal(fields.label.default, 'Read more');
});

test('parses a dynamic material section field', () => {
    const metadata = parsePartDoc(source('@param {string} props.sectionId\n * @kroy sectionId widget=material-section label=Раздел'));
    assert.deepEqual(metadata.fields.sectionId, { type: 'material-section', label: 'Раздел', required: true });
});
