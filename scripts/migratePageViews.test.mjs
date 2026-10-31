import assert from 'node:assert/strict';
import test from 'node:test';
import { migratePageContent, migratePageViews } from './migratePageViews.mjs';

const parts = { '@kroy/reviews': { contract: 'reviews', defaultWidget: '@kroy/slider' } };
const widgets = {
    '@kroy/slider': { contract: 'reviews', fields: { autoplay: { type: 'checkbox', default: true } } },
    '@kroy/cards': { contract: 'reviews', fields: { columns: { type: 'number', default: 3 } } },
};
const legacy = [{ part: '@kroy/reviews', props: { reviewIds: ['b', 'a'], showSubmitButton: true } }];

test('migrates missing views idempotently and preserves existing content, order and selected widgets', () => {
    const snapshot = JSON.stringify(legacy);
    const selected = { part: '@kroy/reviews', props: { title: 'Saved' }, view: { name: '@kroy/cards', props: { columns: 4 } } };
    const migrated = migratePageContent([...legacy, selected], parts, widgets);
    assert.deepEqual(migrated, [{ ...legacy[0], view: { name: '@kroy/slider', props: { autoplay: true } } }, selected]);
    assert.deepEqual(migratePageContent(migrated, parts, widgets), migrated);
    assert.equal(JSON.stringify(legacy), snapshot);
    assert.deepEqual(migratePageContent([], parts, widgets), []);
    assert.throws(() => migratePageContent([{ part: '@kroy/missing', props: {} }], parts, widgets));
    assert.throws(() => migratePageContent([{ ...selected, view: { name: '@kroy/unknown', props: {} } }], parts, widgets));
});

function database() {
    const pages = [{ id: 'active', content: structuredClone(legacy) }, { id: 'trashed', content: structuredClone(legacy) }];
    const calls = [];
    return { pages, calls, async query(sql, values) {
        calls.push(sql);
        if (sql.startsWith('SELECT')) return { rows: structuredClone(pages) };
        if (sql.startsWith('UPDATE')) pages.find(({ id }) => id === values[1]).content = JSON.parse(values[0]);
        return {};
    } };
}

test('dry run never writes; apply covers all pages in a transaction and a repeated apply writes nothing', async () => {
    const client = database();
    assert.deepEqual(await migratePageViews(client, parts, widgets), { scanned: 2, changed: 2, applied: false });
    assert.equal(client.calls.some((sql) => sql.startsWith('UPDATE')), false);
    assert.deepEqual(await migratePageViews(client, parts, widgets, { apply: true }), { scanned: 2, changed: 2, applied: true });
    assert.ok(client.calls.some((sql) => sql.includes('FOR UPDATE') && !sql.includes('WHERE')));
    const updateCount = client.calls.filter((sql) => sql.startsWith('UPDATE')).length;
    assert.deepEqual(await migratePageViews(client, parts, widgets, { apply: true }), { scanned: 2, changed: 0, applied: true });
    assert.equal(client.calls.filter((sql) => sql.startsWith('UPDATE')).length, updateCount);
    assert.equal(client.calls.at(-1), 'COMMIT');
});

test('an invalid page causes rollback without writing partial converted content', async () => {
    const client = database();
    client.pages.push({ id: 'broken', content: [{ part: '@kroy/unknown', props: {} }] });
    await assert.rejects(migratePageViews(client, parts, widgets, { apply: true }));
    assert.equal(client.calls.at(-1), 'ROLLBACK');
    assert.equal(client.calls.some((sql) => sql.startsWith('UPDATE')), false);
});
