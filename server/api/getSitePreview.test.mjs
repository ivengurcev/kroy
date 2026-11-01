import assert from 'node:assert/strict';
import test from 'node:test';
import { pool } from '../../db/client.mjs';
import getSitePreview from './getSitePreview.mjs';

const context = { req: { header: () => 'preview.localhost' }, json: (value) => value };

test('saved-page preview has published summary sources scoped to article-list pages and uses media API covers', async (t) => {
    t.mock.method(pool, 'query', async (sql) => {
        if (sql.includes('LEFT JOIN pages')) return { rows: [
            { id: 'list', path: '/news', title: 'News', type: 'list', dataSource: 'articles', content: [] },
            { id: 'home', path: '/', title: 'Home', type: 'standard', content: [] },
        ] };
        if (sql.includes('SELECT s.id, s.slug')) return { rows: [{ id: 'site' }] };
        if (sql.includes('SELECT theme_id')) return { rows: [{ theme_id: 'calm', theme_mode: 'light', theme_overrides: {} }] };
        if (sql.includes('FROM pages detail')) {
            assert.match(sql, /detail.deleted_at IS NULL AND list.deleted_at IS NULL/);
            return { rows: [{ detailParentId: 'list', path: '/news/:articleId', routeParam: 'articleId' }] };
        }
        if (sql.includes('FROM articles')) {
            assert.match(sql, /status = 'published'/);
            assert.doesNotMatch(sql, /\bcontent\b/);
            return { rows: [
                { slug: 'example', title: 'Published', summary: 'Summary', status: 'published', coverMediaId: 'cover-id' },
                { slug: 'draft', title: 'DRAFT_SENTINEL', status: 'draft' },
            ] };
        }
        if (sql.startsWith('SELECT contact_settings')) return { rows: [{ contact_settings: {} }] };
        if (sql.includes('FROM product_') || sql.includes('FROM products') || sql.includes('FROM reviews')) return { rows: [] };
        assert.fail(`Unexpected preview query: ${sql}`);
    });
    const snapshot = await getSitePreview(context);
    assert.deepEqual(snapshot.pages['/news'].articles, {
        items: [{ slug: 'example', title: 'Published', summary: 'Summary', coverUrl: '/api/media/cover-id', status: 'published' }],
        detailTemplate: { path: '/news/:articleId', routeParam: 'articleId' },
    });
    assert.equal(snapshot.pages['/'].articles, undefined);
    assert.equal(JSON.stringify(snapshot).includes('DRAFT_SENTINEL'), false);
});
