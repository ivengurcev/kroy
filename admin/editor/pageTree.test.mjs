import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPageTree, visiblePageRows, pageRedirects } from './pageTree.mjs';

const page = (path, extra = {}) => ({ id: path, title: path, path, ...extra });
test('URL segments define depth-first order; home is first, templates stay under lists', () => {
    const tree = buildPageTree(['/services/extra', '/articles/:slug', '/contacts', '/', '/articles', '/services', '/about'].map((path) => page(path)));
    assert.deepEqual(visiblePageRows(tree).map(({ path, depth }) => [path, depth]), [
        ['/', 0], ['/about', 0], ['/articles', 0], ['/articles/:slug', 1], ['/contacts', 0], ['/services', 0], ['/services/extra', 1],
    ]);
});
test('missing parents are URL groups, not fictional pages', () => {
    const pages = [page('/services/extra/a')];
    const tree = buildPageTree(pages);
    assert.equal(tree[0].path, '/services');
    assert.deepEqual(tree[0].pages, []);
    assert.equal(tree[0].children[0].children[0].pages[0], pages[0]);
    assert.equal(pages.length, 1);
});
test('collapsed branches hide descendants without hiding other branches', () => {
    const tree = buildPageTree([page('/a'), page('/a/b'), page('/a/b/c'), page('/z')]);
    assert.deepEqual(visiblePageRows(tree, new Set(['/a'])).map(({ path }) => path), ['/a', '/z']);
    assert.equal(visiblePageRows(tree).length, 4);
});
test('deleted visibility and duplicate URL owners do not duplicate branches', () => {
    const pages = [page('/a'), page('/a', { id: 'old', deleted_at: '2026-01-01' }), page('/a/b', { deleted_at: '2026-01-01' })];
    assert.equal(buildPageTree(pages)[0].pages.length, 1);
    const tree = buildPageTree(pages, true);
    assert.equal(tree[0].pages.length, 2);
    assert.equal(tree[0].pages[0].id, '/a');
    assert.equal(tree[0].children.length, 1);
});
test('redirects show only supplied current rules, never self-rules, deleted targets or detail templates', () => {
    const target = page('/a', { redirects: ['/z', '/a', '/old', '/old'] });
    assert.deepEqual(pageRedirects(target), ['/old', '/z']);
    assert.deepEqual(pageRedirects({ ...target, deleted_at: 'now' }), []);
    assert.deepEqual(pageRedirects({ ...target, type: 'detail' }), []);
});
