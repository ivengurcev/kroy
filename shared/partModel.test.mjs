import assert from 'node:assert/strict';
import test from 'node:test';
import { createPart, changePartView, defaultProps } from './partModel.js';

const partMetadata = { contract: 'reviews', defaultWidget: '@kroy/slider', fields: { title: { type: 'input', default: 'Отзывы' }, reviewIds: { type: 'review-list' } } };
const widgets = {
    '@kroy/slider': { contract: 'reviews', fields: { autoplay: { type: 'checkbox', default: true } } },
    '@kroy/cards': { contract: 'reviews', fields: { columns: { type: 'number', default: 3 } } },
    '@kroy/material': { contract: 'material', fields: {} },
};

test('creates a part with the JSDoc default widget and its initial settings', () => {
    const item = createPart('@kroy/reviews', partMetadata, widgets);
    assert.equal(typeof item.id, 'string');
    assert.deepEqual(item.props, { title: 'Отзывы', reviewIds: [] });
    assert.deepEqual(item.view, { name: '@kroy/slider', props: { autoplay: true } });
});

test('richtext defaults stay empty strings and loaded strings/documents are not converted', () => {
    const metadata = { ...partMetadata, fields: { text: { type: 'richtext' } } };
    assert.deepEqual(defaultProps(metadata.fields), { text: '' });
    assert.deepEqual(defaultProps({ showContacts: { type: 'switch' } }), { showContacts: false });
    assert.deepEqual(defaultProps({ showContacts: { type: 'switch', default: true } }), { showContacts: true });
    for (const text of ['Старый текст', { root: { type: 'root', children: [] } }]) {
        const item = createPart('@kroy/reviews', metadata, widgets, { text });
        assert.equal(item.props.text, text);
    }
});

test('changes to a compatible widget without altering the data settings', () => {
    const item = createPart('@kroy/reviews', partMetadata, widgets, { title: 'Custom', reviewIds: ['a', 'b'] });
    const next = changePartView(item, '@kroy/cards', partMetadata, widgets);
    assert.equal(next.props, item.props);
    assert.equal(next.id, item.id);
    assert.deepEqual(next.view, { name: '@kroy/cards', props: { columns: 3 } });
    assert.deepEqual(item.view, { name: '@kroy/slider', props: { autoplay: true } });
    for (const name of ['', '@kroy/missing', '@kroy/material']) {
        assert.throws(() => changePartView(item, name, partMetadata, widgets), /виджет|совместим/i);
    }
});

test('loads stored settings with the selected view and fills widget defaults without mixing data', () => {
    const item = createPart('@kroy/reviews', partMetadata, widgets, { title: 'Saved' }, { name: '@kroy/cards', props: { columns: 4 } });
    assert.equal(item.props.title, 'Saved');
    assert.deepEqual(item.view, { name: '@kroy/cards', props: { columns: 4 } });
    assert.equal(item.props.columns, undefined);
    assert.equal(item.view.props.title, undefined);
    assert.throws(() => createPart('@kroy/reviews', { ...partMetadata, defaultWidget: undefined }, widgets), /виджет/i);
    const savedProps = { title: 'Старый блок', text: 'Сохранённое содержимое' };
    const savedView = { name: '@kroy/about-editorial', props: { imageSide: 'left' } };
    const missing = createPart('@kroy/about', undefined, widgets, savedProps, savedView);
    assert.equal(typeof missing.id, 'string');
    assert.equal(missing.part, '@kroy/about');
    assert.deepEqual(missing.props, savedProps);
    assert.deepEqual(missing.view, savedView);
});
