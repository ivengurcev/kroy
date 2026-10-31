import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveDetailPath } from './pageFields.mjs';

test('resolves a validated template using its actual parameter, including a root list', () => {
    for (const [path, parameter, expected] of [
        ['/articles/:slug', 'slug', '/articles/example'],
        ['/news/:articleId', 'articleId', '/news/example'],
        ['/:entry', 'entry', '/example'],
    ]) assert.equal(resolveDetailPath(path, parameter, 'example'), expected);
});

test('rejects invalid template parameters, unsafe slugs and reserved resulting paths', () => {
    for (const args of [
        ['/news/:slug', 'other', 'example'], ['/news/:slug/more', 'slug', 'example'],
        ['/news/:slug', 'slug', '../unsafe'], ['/:entry', 'entry', 'admin'],
    ]) assert.throws(() => resolveDetailPath(...args));
});
