import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pool } from './client.mjs';

async function withLegacySchema(callback) {
    const client = await pool.connect();
    try {
        assert.ok(process.env.PAGE_TEST_DATABASE);
        const database = (await client.query('SELECT current_database()')).rows[0].current_database;
        assert.equal(database, process.env.PAGE_TEST_DATABASE);
        assert.match(database, /test/i, 'An isolated test database is required');
        await client.query('BEGIN');
        const schema = `page_paths_${randomUUID().replaceAll('-', '')}`;
        await client.query(`CREATE SCHEMA ${schema}`);
        await client.query(`SET LOCAL search_path TO ${schema}`);
        await client.query(`
            CREATE TABLE pages (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                site_id uuid NOT NULL, path text NOT NULL, title text NOT NULL DEFAULT 'Keep',
                content jsonb NOT NULL DEFAULT '[]', seo jsonb NOT NULL DEFAULT '{}',
                deleted_at timestamptz, page_type text NOT NULL DEFAULT 'standard',
                detail_parent_id uuid, UNIQUE (site_id, id),
                FOREIGN KEY (site_id, detail_parent_id) REFERENCES pages(site_id, id)
            );
            CREATE UNIQUE INDEX pages_site_id_path_key ON pages(site_id, path) WHERE deleted_at IS NULL;
            CREATE UNIQUE INDEX pages_one_detail_template_per_list ON pages(site_id, detail_parent_id) WHERE page_type = 'detail';
            CREATE TABLE redirects (
                site_id uuid NOT NULL, from_path text NOT NULL, page_id uuid NOT NULL,
                UNIQUE (site_id, from_path),
                FOREIGN KEY (site_id, page_id) REFERENCES pages(site_id, id)
            );
        `);
        const source = await readFile(new URL('./migrations/202611130003_unique_page_paths.sql', import.meta.url), 'utf8');
        await callback(client, source.split('-- migrate:up')[1].split('-- migrate:down')[0]);
    } finally {
        await client.query('ROLLBACK').catch(() => {});
        client.release();
    }
}

test('page URL migration keeps active content, deterministically deduplicates deleted owners and clears their dependencies', async (t) => {
    if (process.env.RUN_PAGE_INTEGRATION_TESTS !== '1') {
        t.skip('Requires RUN_PAGE_INTEGRATION_TESTS=1 and PAGE_TEST_DATABASE (isolated database)');
        return;
    }
    await withLegacySchema(async (client, migration) => {
        const siteId = randomUUID();
        const otherSite = randomUUID();
        const insert = async (path, deletedAt = null, type = 'standard', parent = null, site = siteId) =>
            (await client.query(`INSERT INTO pages (site_id, path, deleted_at, page_type, detail_parent_id, content, seo)
                VALUES ($1, $2, $3, $4, $5, '[{"keep":true}]', '{"title":"Keep SEO"}') RETURNING *`,
            [site, path, deletedAt, type, parent])).rows[0];
        const old = await insert('/list', '2026-01-01', 'list');
        const oldDetail = await insert('/list/:slug', '2026-01-01', 'detail', old.id);
        const active = await insert('/list', null, 'list');
        const activeDetail = await insert('/list/:slug', null, 'detail', active.id);
        const older = await insert('/deleted', '2026-01-01', 'list');
        const dependency = await insert('/deleted/:slug', '2026-01-01', 'detail', older.id);
        const newest = await insert('/deleted', '2026-02-01');
        const foreign = await insert('/list', null, 'standard', null, otherSite);
        const unchanged = await insert('/unique', '2026-01-01');
        for (const row of [old, oldDetail, older, dependency, active, newest]) {
            await client.query('INSERT INTO redirects VALUES ($1, $2, $3)', [siteId, `/alias-${row.id}`, row.id]);
        }
        await client.query(migration);
        const rows = (await client.query('SELECT * FROM pages ORDER BY id')).rows;
        assert.deepEqual(rows.map(({ id }) => id).sort(), [active.id, activeDetail.id, newest.id, foreign.id, unchanged.id].sort());
        assert.deepEqual(rows.find(({ id }) => id === active.id), active);
        assert.deepEqual(rows.find(({ id }) => id === activeDetail.id), activeDetail);
        assert.deepEqual((await client.query('SELECT page_id FROM redirects ORDER BY page_id')).rows.map(({ page_id }) => page_id).sort(), [active.id, newest.id].sort());
        const definition = (await client.query("SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid = 'pages'::regclass AND conname = 'pages_site_id_path_key'")).rows[0].definition;
        assert.equal(definition, 'UNIQUE (site_id, path)');
        await assert.rejects(insert('/list', '2026-03-01'), { code: '23505' });
    });
});

test('page URL migration aborts rather than delete an active dependent of a duplicate', async (t) => {
    if (process.env.RUN_PAGE_INTEGRATION_TESTS !== '1') {
        t.skip('Requires RUN_PAGE_INTEGRATION_TESTS=1 and PAGE_TEST_DATABASE (isolated database)');
        return;
    }
    await withLegacySchema(async (client, migration) => {
        const siteId = randomUUID();
        const oldId = randomUUID();
        const activeId = randomUUID();
        const childId = randomUUID();
        await client.query(`INSERT INTO pages (id, site_id, path, deleted_at, page_type) VALUES
            ($1, $2, '/same', '2026-01-01', 'list'), ($3, $2, '/same', NULL, 'standard')`, [oldId, siteId, activeId]);
        await client.query("INSERT INTO pages (id, site_id, path, page_type, detail_parent_id) VALUES ($1, $2, '/same/:slug', 'detail', $3)", [childId, siteId, oldId]);
        await client.query('SAVEPOINT before_migration');
        await assert.rejects(client.query(migration), /would remove an active page or template/);
        await client.query('ROLLBACK TO SAVEPOINT before_migration');
        assert.equal((await client.query('SELECT count(*)::int AS count FROM pages')).rows[0].count, 3);
    });
});
