import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pool } from './client.mjs';

const runMigrationTests = process.env.RUN_MATERIAL_MIGRATION_TESTS === '1';

async function withLegacySchema(callback) {
    const client = await pool.connect();
    const schema = `materials_migration_${randomUUID().replaceAll('-', '')}`;
    try {
        const { rows: [{ current_database: currentDatabase }] } = await client.query('SELECT current_database()');
        assert.equal(currentDatabase, process.env.MATERIALS_MIGRATION_TEST_DATABASE);
        assert.match(currentDatabase, /test/i, 'An isolated test database is required');
        await client.query(`CREATE SCHEMA ${schema}`);
        await client.query(`SET search_path TO ${schema}`);
        await client.query(`
            CREATE TABLE sites (id uuid PRIMARY KEY);
            CREATE TABLE media (id uuid PRIMARY KEY);
            CREATE TABLE pages (
                id uuid PRIMARY KEY,
                site_id uuid NOT NULL REFERENCES sites(id),
                content jsonb NOT NULL DEFAULT '[]'::jsonb,
                deleted_at timestamptz,
                page_type text NOT NULL DEFAULT 'standard',
                data_source text,
                detail_parent_id uuid,
                route_param text,
                CONSTRAINT pages_type_fields_check CHECK (
                    (page_type = 'standard' AND data_source IS NULL AND detail_parent_id IS NULL AND route_param IS NULL)
                    OR (page_type = 'list' AND data_source IN ('articles', 'products', 'reviews') AND detail_parent_id IS NULL AND route_param IS NULL)
                    OR (page_type = 'detail' AND data_source IS NULL AND detail_parent_id IS NOT NULL AND route_param IS NOT NULL)
                )
            );
            CREATE TABLE articles (id uuid PRIMARY KEY, site_id uuid);
        `);
        await callback(client, schema);
    } finally {
        await client.query('RESET search_path').catch(() => {});
        await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`).catch(() => {});
        client.release();
    }
}

async function upMigration(client) {
    const source = await readFile(new URL('./migrations/202611020001_replace_articles_with_materials.sql', import.meta.url), 'utf8');
    return client.query(source.split('-- migrate:up')[1].split('-- migrate:down')[0]);
}

test('migration refuses old article Page references before changing the schema', async (t) => {
    if (!runMigrationTests) {
        t.skip('Set RUN_MATERIAL_MIGRATION_TESTS=1 and MATERIALS_MIGRATION_TEST_DATABASE to an isolated test database');
        return;
    }
    await withLegacySchema(async (client) => {
        const siteId = randomUUID();
        await client.query('INSERT INTO sites VALUES ($1)', [siteId]);
        const { rows: [page] } = await client.query(
            `INSERT INTO pages (site_id, page_type, data_source)
             VALUES ($1, 'list', 'articles') RETURNING id`,
            [siteId],
        );

        await assert.rejects(upMigration(client), /old article Page references/i);
        assert.equal((await client.query("SELECT to_regclass('articles') AS table_name")).rows[0].table_name, 'articles');
        assert.equal((await client.query("SELECT data_source FROM pages")).rows[0].data_source, 'articles');

        await client.query(
            `UPDATE pages SET page_type = 'standard', data_source = NULL,
                content = $1::jsonb WHERE id = $2`,
            [JSON.stringify([{ part: '@kroy/material-list', view: { name: '@kroy/article-cards', props: {} }, props: {} }]), page.id],
        );
        await assert.rejects(upMigration(client), /old article Page references/i);
        assert.equal((await client.query("SELECT to_regclass('articles') AS table_name")).rows[0].table_name, 'articles');
    });
});

test('migration replaces empty articles with section-scoped materials and Pages constraints', async (t) => {
    if (!runMigrationTests) {
        t.skip('Set RUN_MATERIAL_MIGRATION_TESTS=1 and MATERIALS_MIGRATION_TEST_DATABASE to an isolated test database');
        return;
    }
    await withLegacySchema(async (client) => {
        await upMigration(client);
        const tables = (await client.query(`
            SELECT to_regclass('material_sections') AS sections,
                   to_regclass('materials') AS materials,
                   to_regclass('articles') AS articles
        `)).rows[0];
        assert.equal(tables.sections, 'material_sections');
        assert.equal(tables.materials, 'materials');
        assert.equal(tables.articles, null);
        const columns = (await client.query(`
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = current_schema() AND table_name = 'pages'
        `)).rows.map(({ column_name }) => column_name);
        assert.ok(columns.includes('material_section_id'));
    });
});

test('database scopes materials by section and limits one active list Page per section', async (t) => {
    if (!runMigrationTests) {
        t.skip('Set RUN_MATERIAL_MIGRATION_TESTS=1 and MATERIALS_MIGRATION_TEST_DATABASE to an isolated test database');
        return;
    }
    await withLegacySchema(async (client) => {
        await upMigration(client);
        const siteA = randomUUID();
        const siteB = randomUUID();
        await client.query('INSERT INTO sites VALUES ($1), ($2)', [siteA, siteB]);
        const sectionA = randomUUID();
        const sectionB = randomUUID();
        const foreignSection = randomUUID();
        await client.query(
            `INSERT INTO material_sections (id, site_id, name, slug) VALUES
                ($1, $2, 'Cases', 'cases'),
                ($3, $2, 'Stories', 'stories'),
                ($4, $5, 'Other', 'other')`,
            [sectionA, siteA, sectionB, foreignSection, siteB],
        );

        const insertMaterial = (sectionId) => client.query(
            `INSERT INTO materials (site_id, section_id, slug, title)
             VALUES ($1, $2, 'same-slug', 'Same')`,
            [siteA, sectionId],
        );
        const first = await insertMaterial(sectionA);
        assert.equal(first.rowCount, 1);
        assert.equal((await insertMaterial(sectionB)).rowCount, 1);
        await assert.rejects(insertMaterial(sectionA), { code: '23505' });
        await assert.rejects(
            client.query(
                `INSERT INTO materials (site_id, section_id, slug, title)
                 VALUES ($1, $2, 'foreign', 'Foreign')`,
                [siteA, foreignSection],
            ),
            { code: '23503' },
        );

        const { rows: [movable] } = await client.query(
            `INSERT INTO materials (site_id, section_id, slug, title)
             VALUES ($1, $2, 'movable', 'Movable') RETURNING id`,
            [siteA, sectionA],
        );
        await client.query('UPDATE materials SET section_id = $1 WHERE id = $2 AND site_id = $3', [sectionB, movable.id, siteA]);
        assert.equal((await client.query('SELECT section_id FROM materials WHERE id = $1', [movable.id])).rows[0].section_id, sectionB);

        const { rows: [listPage] } = await client.query(
            `INSERT INTO pages (site_id, content, page_type, data_source, material_section_id)
             VALUES ($1, '[]', 'list', 'materials', $2) RETURNING id`,
            [siteA, sectionA],
        );
        await assert.rejects(
            client.query(
                `INSERT INTO pages (site_id, content, page_type, data_source, material_section_id)
                 VALUES ($1, '[]', 'list', 'materials', $2)`,
                [siteA, sectionA],
            ),
            { code: '23505' },
        );
        await client.query('UPDATE pages SET deleted_at = now() WHERE id = $1', [listPage.id]);
        await client.query(
            `INSERT INTO pages (site_id, content, page_type, data_source, material_section_id)
             VALUES ($1, '[]', 'list', 'materials', $2)`,
            [siteA, sectionA],
        );
        await assert.rejects(client.query('DELETE FROM material_sections WHERE id = $1', [sectionA]), { code: '23503' });
    });
});
