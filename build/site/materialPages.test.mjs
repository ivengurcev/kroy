import assert from 'node:assert/strict';
import test from 'node:test';
import { assertMaterialPathsAvailable, createMaterialPages } from './createMaterialPages.mjs';

const template = { id: 'template-a', path: '/cases/:slug', route_param: 'slug', content: [], materialSectionId: 'section-a' };
const first = { slug: 'same', title: 'A', summary: '', content: { root: {} }, coverUrl: null };
const second = { ...first, title: 'B' };

test('material detail templates expand only their own section', () => {
    const appearance = { themeMode: 'dark', overrides: { shared: { '--site-font-size-base': '18px' } } };
    const pages = createMaterialPages([{ ...template, appearance }], { 'section-a': [first], 'section-b': [second] });
    assert.equal(pages.length, 1);
    assert.equal(pages[0].title, 'A');
    assert.equal(pages[0].path, '/cases/same');
    assert.deepEqual(pages[0].appearance, appearance);
});

test('material paths can share slugs across sections but reject resolved collisions', () => {
    assert.doesNotThrow(() => assertMaterialPathsAvailable([
        ...createMaterialPages([template], { 'section-a': [first] }),
        ...createMaterialPages([{ ...template, id: 'template-b', materialSectionId: 'section-b', path: '/stories/:slug' }], { 'section-b': [second] }),
    ]));
    assert.throws(() => assertMaterialPathsAvailable([
        ...createMaterialPages([template], { 'section-a': [first] }),
        ...createMaterialPages([{ ...template, id: 'template-b', materialSectionId: 'section-b' }], { 'section-b': [second] }),
    ]), /collision/);
});

test('material detail paths collide with reserved routes', () => {
    assert.throws(() => assertMaterialPathsAvailable(createMaterialPages([template], { 'section-a': [first] }), ['/cases/same']), /collision/);
});
