import assert from 'node:assert/strict';
import test from 'node:test';
import { spacingFields, widgetSpacingStyle } from './widgetDisplay.js';
import { heroHeightMode, heroHeightStyle } from '../site/runtime/heroHeight.js';
import { createPart } from './partModel.js';

test('auto and missing spacing produce no overrides; each edge independently uses theme tokens', () => {
    assert.deepEqual(widgetSpacingStyle(), {});
    assert.deepEqual(widgetSpacingStyle({ spacingTop: 'auto', spacingBottom: 'auto' }), {});
    const values = ['0', 'calc(var(--site-section-gap) / 4)', 'calc(var(--site-section-gap) / 2)', 'var(--site-section-gap)'];
    for (const [index, value] of ['none', 'small', 'normal', 'large'].entries()) {
        assert.deepEqual(widgetSpacingStyle({ spacingTop: value }), { paddingTop: values[index] });
        assert.deepEqual(widgetSpacingStyle({ spacingBottom: value }), { paddingBottom: values[index] });
    }
    assert.deepEqual(widgetSpacingStyle({ spacingTop: 'none', spacingBottom: 'large' }), { paddingTop: '0', paddingBottom: 'var(--site-section-gap)' });
    assert.deepEqual(widgetSpacingStyle({ spacingTop: 'toString', spacingBottom: '12px' }), {});
    assert.equal(spacingFields.spacingTop.default, 'auto');
});

test('legacy height is honored in normal even after createPart fills heightMode defaults', () => {
    const metadata = { contract: 'hero', defaultWidget: 'hero', fields: {} };
    const widgets = { hero: { contract: 'hero', fields: { heightMode: { type: 'select', default: 'normal' } } } };
    const item = createPart('hero', metadata, widgets, {}, { name: 'hero', props: { minHeight: 900 } });
    assert.equal(item.view.props.heightMode, 'normal');
    assert.deepEqual(heroHeightStyle(item.view.props), { '--hero-min-height': '900px' });
    for (const heightMode of ['compact', 'spacious']) {
        assert.equal(heroHeightMode({ heightMode }), heightMode);
        assert.deepEqual(heroHeightStyle({ heightMode, minHeight: 900 }), {});
    }
    for (const minHeight of [-1, NaN, Infinity, '900', undefined]) assert.deepEqual(heroHeightStyle({ minHeight }), {});
    assert.deepEqual(heroHeightStyle({ minHeight: 0 }), { '--hero-min-height': '0px' });
});
