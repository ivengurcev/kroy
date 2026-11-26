import assert from 'node:assert/strict';
import test from 'node:test';
import {
    FOOTER_PART,
    resolvePageTemplate,
    splitTemplateContent,
    validateTemplateContent,
} from './pageTemplates.mjs';

const main = { id: 'main', isMain: true };
const alternate = { id: 'alternate', isMain: false };
const templates = [main, alternate];

test('page selection respects site defaults, explicit assignments, and none', () => {
    assert.equal(resolvePageTemplate({}, null, templates), main);
    assert.equal(resolvePageTemplate({ templateMode: 'inherit' }, alternate.id, templates), alternate);
    assert.equal(resolvePageTemplate({ templateMode: 'template', templateId: main.id }, alternate.id, templates), main);
    assert.equal(resolvePageTemplate({ type: 'detail', templateMode: 'none' }, alternate.id, templates), null);
    assert.throws(() => resolvePageTemplate({ templateMode: 'template', templateId: 'missing' }, null, templates), /Выбранный шаблон/);
    assert.throws(() => resolvePageTemplate({}, alternate.id, [alternate]), /Основной шаблон/);
});

test('slot divides blocks without modifying the document', () => {
    const content = ['head', 'tail'];
    assert.deepEqual(splitTemplateContent({ content, slotIndex: 0 }), { before: [], after: content });
    assert.deepEqual(splitTemplateContent({ content, slotIndex: 1 }), { before: ['head'], after: ['tail'] });
    assert.deepEqual(splitTemplateContent({ content, slotIndex: 2 }), { before: content, after: [] });
    assert.deepEqual(splitTemplateContent({ content: [], slotIndex: 0 }), { before: [], after: [] });
    for (const slotIndex of [-1, 3, 0.5, '1', undefined]) {
        assert.throws(() => splitTemplateContent({ content, slotIndex }), /позиция/);
    }
});

test('template validation preserves the widget contract and reserves the global footer', () => {
    const header = '@kroy/header';
    const parts = { [header]: { contract: 'header' }, [FOOTER_PART]: { contract: 'footer' } };
    const widget = (name) => ({ name, props: {} });
    const widgets = parts;
    const content = [{ part: header, props: {}, view: widget(header) }];
    assert.deepEqual(validateTemplateContent({ content, slotIndex: 1 }, parts, widgets), []);
    assert.deepEqual(validateTemplateContent({ content, slotIndex: 2 }, parts, widgets).map(({ code }) => code), ['invalid_slot']);
    assert.deepEqual(validateTemplateContent({
        content: [{ ...content[0], view: widget(FOOTER_PART) }], slotIndex: 0,
    }, parts, widgets).map(({ code }) => code), ['incompatible_contract']);
    assert.deepEqual(validateTemplateContent({
        content: [{ part: FOOTER_PART, props: {}, view: widget(FOOTER_PART) }], slotIndex: 0,
    }, parts, widgets).map(({ code }) => code), ['global_footer']);
});
