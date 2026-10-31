import assert from 'node:assert/strict';
import test from 'node:test';
import { createPart, changePartView } from './partModel.js';

const partMetadata = { contract: 'reviews', defaultWidget: '@kroy/slider', fields: { title: { type: 'input', default: 'Отзывы' }, reviewIds: { type: 'review-list' } } };
const widgets = {
    '@kroy/slider': { contract: 'reviews', fields: { autoplay: { type: 'checkbox', default: true } } },
    '@kroy/cards': { contract: 'reviews', fields: { columns: { type: 'number', default: 3 } } },
    '@kroy/article': { contract: 'article', fields: {} },
};

test('creates a part with the JSDoc default widget and its initial settings', () => {
    const item = createPart('@kroy/reviews', partMetadata, widgets);
    assert.equal(typeof item.id, 'string');
    assert.deepEqual(item.props, { title: 'Отзывы', reviewIds: [] });
    assert.deepEqual(item.view, { name: '@kroy/slider', props: { autoplay: true } });
});

test('changes to a compatible widget without altering the data settings', () => {
    const item = createPart('@kroy/reviews', partMetadata, widgets, { title: 'Custom', reviewIds: ['a', 'b'] });
    const next = changePartView(item, '@kroy/cards', partMetadata, widgets);
    assert.equal(next.props, item.props);
    assert.equal(next.id, item.id);
    assert.deepEqual(next.view, { name: '@kroy/cards', props: { columns: 3 } });
    assert.deepEqual(item.view, { name: '@kroy/slider', props: { autoplay: true } });
    for (const name of ['', '@kroy/missing', '@kroy/article']) {
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
});
