import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { discoverParts, discoverWidgets, validateDefaultWidgets } from './discoverParts.mjs';

const part = { name: '@kroy/reviews', contract: 'reviews', defaultWidget: '@kroy/reviews-slider' };
const widget = { name: '@kroy/reviews-slider', contract: 'reviews' };

test('requires an existing default widget with exactly the same nonempty contract', () => {
    assert.doesNotThrow(() => validateDefaultWidgets([part], [widget]));
    for (const invalid of [{ ...part, defaultWidget: undefined }, { ...part, defaultWidget: '@kroy/missing' }, { ...part, contract: undefined }, { ...part, contract: 'review' }]) {
        assert.throws(() => validateDefaultWidgets([invalid], [widget]), /виджет|контракт|совместим/i);
    }
    assert.throws(() => validateDefaultWidgets([{ ...part, contract: undefined }], [{ ...widget, contract: undefined }]), /контракт|совместим/i);
});

test('discovers package entry points and excludes ReviewForm helpers', async (t) => {
    const root = await mkdtemp(join(tmpdir(), 'kroy-parts-'));
    t.after(() => rm(root, { recursive: true, force: true }));
    const directory = join(root, 'reviews');
    await mkdir(directory);
    await writeFile(join(directory, 'package.json'), JSON.stringify({ name: '@kroy/reviews', main: 'prepareReviews.mjs' }));
    await writeFile(join(directory, 'prepareReviews.mjs'), `/**
     * @kroy-contract reviews
     * @kroy-default-widget @kroy/reviews-slider
     */
    export default function prepareReviews() { return {}; }`);
    await writeFile(join(directory, 'ReviewForm.jsx'), 'export default function ReviewForm() {}');
    await writeFile(join(root, 'Helper.jsx'), 'export default function Helper() {}');
    const found = await discoverParts(root);
    assert.equal(found.length, 1);
    assert.equal(found[0].name, '@kroy/reviews');
    assert.equal(found[0].defaultWidget, '@kroy/reviews-slider');
});

test('all real parts declare compatible default widgets and no form is registered', async () => {
    const parts = await discoverParts();
    const widgets = await discoverWidgets();
    assert.equal(parts.length, 10);
    validateDefaultWidgets(parts, widgets);
    assert.equal(parts.some(({ name }) => name.includes('form')), false);
});
