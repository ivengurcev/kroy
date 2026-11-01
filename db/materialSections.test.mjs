import assert from 'node:assert/strict';
import test from 'node:test';
import { pool } from './client.mjs';
import { createMaterialSection, getMaterialSections } from './materialSections.mjs';

test('lists sections for one site ordered by sort order', async (t) => {
    t.mock.method(pool, 'query', async (sql, values) => {
        assert.match(sql, /FROM material_sections/);
        assert.match(sql, /WHERE site_id = \$1/);
        assert.match(sql, /ORDER BY sort_order, id/);
        assert.deepEqual(values, ['site-a']);
        return { rows: [{ id: 'section-id', site_id: 'site-a', name: 'Cases', slug: 'cases', sort_order: 2 }] };
    });

    assert.deepEqual(await getMaterialSections('site-a'), [{
        id: 'section-id', siteId: 'site-a', name: 'Cases', slug: 'cases', sortOrder: 2,
    }]);
});

test('creates a section scoped to the selected site', async (t) => {
    t.mock.method(pool, 'query', async (sql, values) => {
        assert.match(sql, /INSERT INTO material_sections/);
        assert.deepEqual(values, ['site-a', 'Cases', 'cases', 2]);
        return { rows: [{ id: 'section-id', site_id: 'site-a', name: 'Cases', slug: 'cases', sort_order: 2 }] };
    });

    assert.deepEqual(await createMaterialSection('site-a', { name: 'Cases', slug: 'cases', sortOrder: 2 }), {
        id: 'section-id', siteId: 'site-a', name: 'Cases', slug: 'cases', sortOrder: 2,
    });
});

test('checks materials, Pages, and material-list block references before section deletion', async () => {
    let sql;
    const { hasMaterialSectionReferences } = await import('./materialSections.mjs');
    const used = await hasMaterialSectionReferences('site-id', 'section-id', {
        async query(query) { sql = query; return { rows: [{ is_referenced: true }] }; },
    });
    assert.equal(used, true);
    assert.match(sql, /FROM materials/);
    assert.match(sql, /material_section_id = \$2/);
    assert.match(sql, /@kroy\/material-list/);
});
