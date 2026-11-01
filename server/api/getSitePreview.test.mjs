import assert from 'node:assert/strict';
import test from 'node:test';
import { pool } from '../../db/client.mjs';
import getSitePreview from './getSitePreview.mjs';

const context = { req: { header: () => 'preview.localhost' }, json: (value) => value };

test('saved-page preview has published summary sources scoped to material-list pages and uses media API covers', async (t) => {
    t.mock.method(pool, 'query', async (sql) => {
        if (sql.includes('LEFT JOIN pages')) return { rows: [
            { id: 'list', path: '/news', title: 'News', type: 'list', dataSource: 'materials', materialSectionId: 'section-id', content: [] },
            { id: 'home', path: '/', title: 'Home', type: 'standard', content: [] },
        ] };
        if (sql.includes('SELECT s.id, s.slug')) return { rows: [{ id: 'site' }] };
        if (sql.includes('SELECT theme_id')) return { rows: [{ theme_id: 'calm', theme_mode: 'light', theme_overrides: {} }] };
        if (sql.includes('FROM pages detail')) {
            assert.match(sql, /detail.deleted_at IS NULL AND list.deleted_at IS NULL/);
            return { rows: [{ detailParentId: 'list', materialSectionId: 'section-id', path: '/news/:slug', routeParam: 'slug' }] };
        }
        if (sql.includes('FROM material_sections')) return { rows: [{ id: 'section-id', site_id: 'site', name: 'Cases', slug: 'cases', sort_order: 0 }] };
        if (sql.includes('FROM materials')) {
            assert.match(sql, /status = 'published'/);
            assert.doesNotMatch(sql, /\bcontent\b/);
            return { rows: [
                { section_id: 'section-id', slug: 'example', title: 'Published', summary: 'Summary', status: 'published', coverMediaId: 'cover-id' },
            ] };
        }
        if (sql.startsWith('SELECT contact_settings')) return { rows: [{ contact_settings: {} }] };
        if (sql.includes('FROM product_') || sql.includes('FROM products') || sql.includes('FROM reviews')) return { rows: [] };
        assert.fail(`Unexpected preview query: ${sql}`);
    });
    const snapshot = await getSitePreview(context);
    assert.deepEqual(snapshot.pages['/news'].materials['section-id'], {
        items: [{ slug: 'example', title: 'Published', summary: 'Summary', coverUrl: '/api/media/cover-id', status: 'published' }],
        detailTemplate: { path: '/news/:slug', routeParam: 'slug' },
    });
    assert.equal(snapshot.pages['/'].materials['section-id'].items.length, 1);
});
