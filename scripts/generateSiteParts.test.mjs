import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, rm, writeFile } from 'node:fs/promises';
import generateSiteParts from './generateSiteParts.mjs';

const output = new URL('../dist/kroy/site-parts.mjs', import.meta.url);

test('imports only selected data parts and widgets, including a non-default compatible widget', async (t) => {
    const previous = await readFile(output).catch((error) => { if (error.code !== 'ENOENT') throw error; return null; });
    t.after(() => previous === null ? rm(output, { force: true }) : writeFile(output, previous));
    await generateSiteParts([{ content: [
        { part: '@kroy/reviews', props: {}, view: { name: '@kroy/review-cards', props: { columns: 3 } } },
        { part: '@kroy/reviews', props: {}, view: { name: '@kroy/review-cards', props: { columns: 4 } } },
    ] }], 'test');
    const source = await readFile(output, 'utf8');
    assert.match(source, /site\/parts\/reviews\/prepareReviews\.mjs/);
    assert.match(source, /site\/widgets\/review-cards\/ReviewCards\.jsx/);
    assert.equal((source.match(/import /g) ?? []).length, 2);
    assert.doesNotMatch(source, /ReviewsSlider|ReviewForm|ArticleContent|Hero/);
});

test('rejects missing and incompatible views instead of importing legacy display parts', async () => {
    for (const item of [
        { part: '@kroy/reviews', props: {} },
        { part: '@kroy/reviews', props: {}, view: { name: '@kroy/article-content', props: {} } },
    ]) await assert.rejects(generateSiteParts([{ content: [item] }], 'test'), /совместимый виджет/);
});
