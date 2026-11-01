import assert from 'node:assert/strict';
import test from 'node:test';
import { pool } from './client.mjs';
import { createMaterial, getMaterials, updateMaterial } from './materials.mjs';

const materialRow = {
    id: 'material-id', site_id: 'site-a', section_id: 'section-a', slug: 'first',
    title: 'First', summary: '', content: null, cover_media_id: null, status: 'draft',
    created_at: 'created', updated_at: 'updated', published_at: null,
};

test('lists materials scoped to both the current site and selected section', async (t) => {
    t.mock.method(pool, 'query', async (sql, values) => {
        assert.match(sql, /FROM materials/);
        assert.match(sql, /WHERE site_id = \$1 AND section_id = \$2/);
        assert.deepEqual(values, ['site-a', 'section-a']);
        return { rows: [materialRow] };
    });

    assert.deepEqual(await getMaterials('site-a', { sectionId: 'section-a' }), [{
        id: 'material-id', siteId: 'site-a', sectionId: 'section-a', slug: 'first',
        title: 'First', summary: '', content: null, coverMediaId: null, status: 'draft',
        createdAt: 'created', updatedAt: 'updated', publishedAt: null,
    }]);
});

test('creates a material with its required section', async (t) => {
    t.mock.method(pool, 'query', async (sql, values) => {
        assert.match(sql, /INSERT INTO materials/);
        assert.deepEqual(values, ['site-a', 'section-a', 'first', 'First', '', null, null, 'draft']);
        return { rows: [materialRow] };
    });

    const { id, siteId, sectionId, slug } = await createMaterial('site-a', {
        sectionId: 'section-a', slug: 'first', title: 'First', summary: '',
        content: null, coverMediaId: null, status: 'draft',
    });
    assert.deepEqual({ id, siteId, sectionId, slug }, {
        id: 'material-id', siteId: 'site-a', sectionId: 'section-a', slug: 'first',
    });
});

test('moves a material only through a site-scoped update', async (t) => {
    t.mock.method(pool, 'query', async (sql, values) => {
        assert.match(sql, /UPDATE materials/);
        assert.match(sql, /WHERE id = \$2 AND site_id = \$1/);
        assert.deepEqual(values, ['site-a', 'material-id', 'section-b']);
        return { rows: [{ ...materialRow, section_id: 'section-b' }] };
    });

    assert.equal((await updateMaterial('site-a', 'material-id', { sectionId: 'section-b' })).sectionId, 'section-b');
});
