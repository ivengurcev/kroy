import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeMaterialSectionInput } from './materialSections.mjs';

test('material section input validates names, internal slugs, and ordering', () => {
    assert.deepEqual(normalizeMaterialSectionInput({ name: 'Cases', slug: 'cases', sortOrder: 2 }), { name: 'Cases', slug: 'cases', sortOrder: 2 });
    assert.equal(normalizeMaterialSectionInput({ name: 'Cases', slug: 'Cases', sortOrder: 2 }), null);
    assert.equal(normalizeMaterialSectionInput({ name: '', slug: 'cases', sortOrder: 0 }), null);
    assert.equal(normalizeMaterialSectionInput({ name: 'Cases', slug: 'cases', sortOrder: 1.5 }), null);
});

test('concurrent section-use foreign key conflicts return 409 instead of 500', async (t) => {
    const { pool } = await import('../../db/client.mjs');
    const { deleteSiteMaterialSection } = await import('./materialSections.mjs');
    t.mock.method(pool, 'query', async () => ({ rows: [{ id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }] }));
    t.mock.method(pool, 'connect', async () => ({
        async query(sql) {
            if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [] };
            if (sql.includes('DELETE FROM material_sections')) throw Object.assign(new Error('foreign key conflict'), { code: '23503' });
            if (sql.includes('AS is_referenced')) return { rows: [{ is_referenced: false }] };
            if (sql.includes('FROM material_sections')) return { rows: [{ id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' }] };
            return { rows: [], rowCount: 1 };
        },
        release() {},
    }));
    const result = await deleteSiteMaterialSection({
        req: { header: (name) => name === 'Host' ? 'test.localhost' : undefined, param: () => 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' },
        json: (value, status = 200) => ({ value, status }),
        body: (_value, status) => ({ status }),
    });
    assert.equal(result.status, 409);
    assert.equal(result.value.error, 'Material section is in use');
});
