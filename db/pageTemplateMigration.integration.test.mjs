import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { pool } from './client.mjs';
import { createMainPageTemplate } from './pageTemplates.mjs';

test('template migration keeps existing pages and footer settings and initializes new sites separately', async (t) => {
    if (process.env.RUN_PAGE_INTEGRATION_TESTS !== '1') {
        t.skip('Requires RUN_PAGE_INTEGRATION_TESTS=1 and PAGE_TEST_DATABASE (isolated database)');
        return;
    }

    const client = await pool.connect();
    try {
        const { rows: [{ current_database: database }] } = await client.query('SELECT current_database()');
        assert.equal(database, process.env.PAGE_TEST_DATABASE);
        assert.match(database, /test/i, 'An isolated test database is required');
        await client.query('BEGIN');
        const schema = `page_templates_${randomUUID().replaceAll('-', '')}`;
        await client.query(`CREATE SCHEMA ${schema}`);
        await client.query(`SET LOCAL search_path TO ${schema}`);
        await client.query(`
            CREATE TABLE sites (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), footer_settings jsonb NOT NULL DEFAULT '{}');
            CREATE TABLE pages (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                site_id uuid NOT NULL REFERENCES sites(id),
                content jsonb NOT NULL DEFAULT '[]',
                deleted_at timestamptz
            );
        `);
        const footerSettings = { description: 'Описание', documents: { offerPageId: randomUUID() } };
        const { rows: [oldSite] } = await client.query(
            'INSERT INTO sites (footer_settings) VALUES ($1) RETURNING *', [JSON.stringify(footerSettings)],
        );
        const { rows: [oldPage] } = await client.query(
            "INSERT INTO pages (site_id, content, deleted_at) VALUES ($1, '[{\"keep\":true}]', now()) RETURNING *", [oldSite.id],
        );

        const migration = await readFile(new URL('./migrations/202611270001_add_page_templates.sql', import.meta.url), 'utf8');
        const [up, down] = migration.split('-- migrate:down');
        await client.query(up);
        assert.deepEqual((await client.query('SELECT * FROM sites WHERE id = $1', [oldSite.id])).rows[0], {
            ...oldSite, footer_version: 1, default_template_id: null,
        });
        assert.deepEqual((await client.query('SELECT * FROM pages WHERE id = $1', [oldPage.id])).rows[0], {
            ...oldPage, template_mode: 'inherit', template_id: null,
        });

        const { rows: [newSite] } = await client.query('INSERT INTO sites DEFAULT VALUES RETURNING *');
        await createMainPageTemplate(client, newSite.id);
        await createMainPageTemplate(client, newSite.id);
        const { rows } = await client.query('SELECT site_id, id, content, slot_index, is_main FROM page_templates');
        assert.equal(rows.length, 2);
        const existing = rows.find(({ site_id }) => site_id === oldSite.id);
        const created = rows.find(({ site_id }) => site_id === newSite.id);
        assert.deepEqual(existing.content, []);
        assert.equal(existing.slot_index, 0);
        assert.equal(existing.is_main, true);
        assert.deepEqual(created.content, [{
            part: '@kroy/header', props: { title: '', navigation: [] }, view: { name: '@kroy/header', props: {} },
        }]);
        assert.equal(created.slot_index, 1);
        assert.equal(created.is_main, true);

        for (const [sql, params, code] of [
            ['UPDATE pages SET template_mode = $1, template_id = $2 WHERE id = $3', ['template', created.id, oldPage.id], '23503'],
            ['UPDATE sites SET default_template_id = $1 WHERE id = $2', [created.id, oldSite.id], '23503'],
            ['UPDATE pages SET template_mode = $1, template_id = $2 WHERE id = $3', ['none', existing.id, oldPage.id], '23514'],
            ['UPDATE page_templates SET slot_index = $1 WHERE id = $2', [1, existing.id], '23514'],
        ]) {
            await client.query('SAVEPOINT invalid_write');
            await assert.rejects(client.query(sql, params), { code });
            await client.query('ROLLBACK TO SAVEPOINT invalid_write');
            await client.query('RELEASE SAVEPOINT invalid_write');
        }

        await client.query(down);
        assert.deepEqual((await client.query('SELECT * FROM sites WHERE id = $1', [oldSite.id])).rows[0], oldSite);
        assert.deepEqual((await client.query('SELECT * FROM pages WHERE id = $1', [oldPage.id])).rows[0], oldPage);
    } finally {
        await client.query('ROLLBACK').catch(() => {});
        client.release();
    }
});
