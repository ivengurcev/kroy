import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { pool } from '../../db/client.mjs';
import { createMainPageTemplate } from '../../db/pageTemplates.mjs';
import { getSiteFingerprint } from '../../db/siteFingerprint.mjs';
import { legalDocumentBlock } from '../../shared/legalDocuments.mjs';
import { toLexicalDocument } from '../../admin/ui/richTextState.mjs';
import deletePage from './deletePage.mjs';
import getPage from './getPage.mjs';
import getSitePreview from './getSitePreview.mjs';
import patchPage from './patchPage.mjs';
import postPage from './postPage.mjs';
import putPage from './putPage.mjs';
import restorePage from './restorePage.mjs';

test('legal pages follow page transactions, URL lifecycle and the site snapshot', async (t) => {
    if (process.env.RUN_PAGE_INTEGRATION_TESTS !== '1') return t.skip('Requires isolated migrated PostgreSQL');
    const { rows: [{ current_database: database }] } = await pool.query('SELECT current_database()');
    assert.equal(database, process.env.PAGE_TEST_DATABASE);
    assert.match(database, /test/i);
    await t.test('migration keeps old page data and footer settings untouched', async () => {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await client.query(`CREATE TEMP TABLE pages (page_type text NOT NULL, content jsonb NOT NULL);
                CREATE TEMP TABLE sites (footer_settings jsonb NOT NULL);`);
            const oldContent = [{ part: '@kroy/text', props: { text: 'Original' }, view: { name: '@kroy/text', props: {} } }];
            const oldFooter = { documents: { privacyPageId: randomUUID(), additional: [{ label: 'External', url: 'https://example.org' }] } };
            await client.query("INSERT INTO pages VALUES ('standard', $1)", [JSON.stringify(oldContent)]);
            await client.query('INSERT INTO sites VALUES ($1)', [oldFooter]);
            const migration = await readFile(new URL('../../db/migrations/202611270002_add_legal_documents.sql', import.meta.url), 'utf8');
            const [up, down] = migration.split('-- migrate:down');
            await client.query(up);
            assert.deepEqual((await client.query('SELECT * FROM pages')).rows, [
                { page_type: 'standard', content: oldContent, is_legal_document: false },
            ]);
            assert.deepEqual((await client.query('SELECT footer_settings FROM sites')).rows[0].footer_settings, oldFooter);
            await client.query(down);
            assert.deepEqual((await client.query('SELECT * FROM pages')).rows, [{ page_type: 'standard', content: oldContent }]);
        } finally {
            await client.query('ROLLBACK');
            client.release();
        }
    });
    const sites = [];
    t.after(async () => {
        await pool.query('DELETE FROM redirects WHERE site_id = ANY($1::uuid[])', [sites]);
        await pool.query('DELETE FROM pages WHERE site_id = ANY($1::uuid[])', [sites]);
        await pool.query('DELETE FROM domains WHERE site_id = ANY($1::uuid[])', [sites]);
        await pool.query('DELETE FROM sites WHERE id = ANY($1::uuid[])', [sites]);
        await pool.end();
    });

    async function createSite() {
        const slug = `legal-${randomUUID()}`;
        const { rows: [site] } = await pool.query('INSERT INTO sites (slug, name) VALUES ($1, $1) RETURNING id', [slug]);
        sites.push(site.id);
        await createMainPageTemplate(pool, site.id);
        const hostname = `${slug}.example`;
        await pool.query('INSERT INTO domains (site_id, hostname) VALUES ($1, $2)', [site.id, hostname]);
        return (api, body, id, query = {}) => api({
            req: { header: () => hostname, param: () => id, json: async () => body, query: (name) => query[name] },
            json: (value, status = 200) => ({ value, status }),
            body: (value, status) => ({ value, status }),
        });
    }

    const call = await createSite();
    const foreign = await createSite();
    const text = JSON.parse(JSON.stringify(toLexicalDocument('Условия\n\nВторой абзац')));
    const revisedText = JSON.parse(JSON.stringify(toLexicalDocument('Новая редакция')));
    const input = { title: '  Условия  ', path: '/legal/terms', content: text, isLegalDocument: true };
    const { status, value: created } = await call(postPage, input);
    assert.equal(status, 201);
    assert.equal(created.type, 'standard');
    assert.equal(created.isLegalDocument, true);
    assert.equal(created.title, 'Условия');
    assert.deepEqual(created.content, [legalDocumentBlock(text)]);
    assert.equal((await call(getPage)).find(({ id }) => id === created.id).isLegalDocument, true);
    assert.equal((await foreign(getPage, null, created.id)).status, 404);
    assert.equal((await foreign(patchPage, { ...input, expectedLegalVersion: created.legalVersion }, created.id)).status, 404);
    assert.equal((await foreign(postPage, { ...input, title: 'Другой сайт' })).status, 201);
    assert.deepEqual((await foreign(getSitePreview)).value.footer.documents, [{ label: 'Другой сайт', href: input.path }]);
    assert.equal((await call(postPage, input)).value.fields.path, 'Такой адрес уже используется');
    for (const [body, field] of [[{ path: '/admin/privacy' }, 'path'], [{ path: '/auth/privacy' }, 'path'], [{ content: 'plain' }, 'content']]) {
        const rejected = await call(postPage, { ...input, path: '/new', ...body });
        assert.equal(rejected.status, 400);
        assert.ok(rejected.value.fields[field]);
    }
    assert.equal((await call(postPage, { ...input, type: 'list', dataSource: 'reviews' })).status, 400);

    const { value: ordinary } = await call(postPage, { title: 'Обычная', path: '/reserved' });
    const amend = { title: 'Новые условия', path: '/new-terms', content: revisedText, expectedLegalVersion: created.legalVersion };
    const before = await getSiteFingerprint(created.site_id);
    assert.equal((await call(patchPage, { ...amend, path: ordinary.path }, created.id)).status, 409);
    assert.equal((await call(patchPage, { ...amend, content: { root: { type: 'root' } } }, created.id)).status, 400);
    assert.equal((await call(putPage, { content: [] }, created.id)).status, 409);
    assert.equal((await call(putPage, {
        content: [], expectedLegalVersion: created.legalVersion,
        footerChanges: { expectedVersion: 1, props: { description: 'Must roll back' } },
    }, created.id)).status, 400);
    assert.equal(await getSiteFingerprint(created.site_id), before);
    assert.equal((await call(getSitePreview)).value.footer.description, '');

    const [first, second] = await Promise.all([call(patchPage, amend, created.id), call(patchPage, amend, created.id)]);
    assert.deepEqual([first.status ?? 200, second.status ?? 200].sort(), [200, 409]);
    assert.equal((first.value ?? second.value).code, 'legal_document_conflict');
    const saved = await call(getPage, null, created.id);
    assert.equal(saved.title, amend.title);
    assert.equal(saved.path, amend.path);
    assert.deepEqual(saved.content, [legalDocumentBlock(revisedText)]);
    assert.notEqual(saved.legalVersion, created.legalVersion);
    assert.notEqual(await getSiteFingerprint(created.site_id), before);
    assert.deepEqual((await call(getSitePreview)).value.footer.documents, [{ label: amend.title, href: amend.path }]);
    assert.equal((await call(getSitePreview)).value.pages[amend.path].templateIndex, 0);

    const normalEditorSave = await call(putPage, { content: [legalDocumentBlock(text)], expectedLegalVersion: saved.legalVersion }, saved.id);
    assert.deepEqual(normalEditorSave.value.content, [legalDocumentBlock(text)]);
    assert.equal((await call(patchPage, { ...amend, expectedLegalVersion: saved.legalVersion }, saved.id)).status, 409);
    assert.equal((await call(patchPage, { title: 'Через настройки', expectedLegalVersion: normalEditorSave.value.legalVersion }, saved.id)).title, 'Через настройки');
    assert.equal((await call(deletePage, null, saved.id)).status, 204);
    assert.deepEqual((await call(getSitePreview)).value.footer.documents, []);
    assert.equal((await call(getPage, null, undefined, { deleted: '1' }))[0].isLegalDocument, true);
    assert.equal((await call(restorePage, null, saved.id)).id, saved.id);
    const restored = await call(getPage, null, saved.id);
    assert.deepEqual(restored.content, [legalDocumentBlock(text)]);
    assert.deepEqual((await call(getSitePreview)).value.footer.documents, [{ label: 'Через настройки', href: saved.path }]);

    const external = { label: 'Внешняя ссылка', url: 'https://example.org/legal' };
    const legacyFooter = { description: 'Existing', documents: {
        privacyPageId: ordinary.id, offerPageId: ordinary.id, additional: [{ pageId: ordinary.id }, external],
    } };
    await pool.query('UPDATE sites SET footer_settings = $2 WHERE id = $1', [created.site_id, legacyFooter]);
    const getFooter = async () => (await call(getSitePreview)).value.footer;
    assert.deepEqual((await getFooter()).documents.slice(1).map(({ href }) => href), [ordinary.path, external.url]);
    const promotion = { isLegalDocument: true, expectedLegalVersion: ordinary.legalVersion };
    assert.equal((await call(patchPage, { ...promotion, content: text }, ordinary.id)).status, 400);
    await call(putPage, { content: [legalDocumentBlock(text)] }, ordinary.id);
    const ready = await call(getPage, null, ordinary.id);
    const beforePromotion = await getSiteFingerprint(created.site_id);
    const promoted = await call(patchPage, { ...promotion, expectedLegalVersion: ready.legalVersion }, ready.id);
    assert.equal(promoted.isLegalDocument, true);
    assert.equal(promoted.id, ready.id);
    assert.deepEqual(promoted.content, ready.content);
    assert.notEqual(await getSiteFingerprint(created.site_id), beforePromotion);
    assert.deepEqual((await getFooter()).documents, [
        { label: 'Через настройки', href: saved.path }, { label: ready.title, href: ready.path }, { label: external.label, href: external.url },
    ]);
    const storedFooter = async () => (await pool.query('SELECT footer_settings, footer_version FROM sites WHERE id = $1', [created.site_id])).rows[0];
    assert.deepEqual(await storedFooter(), { footer_settings: legacyFooter, footer_version: 1 });
    await call(deletePage, null, promoted.id);
    assert.equal((await getFooter()).documents.some(({ href }) => href === promoted.path), false);
    const { value: reused } = await call(postPage, { title: 'Новая страница', path: promoted.path });
    assert.equal(reused.id, promoted.id);
    assert.equal(reused.isLegalDocument, false);
    assert.deepEqual(reused.content, []);
    assert.deepEqual(await storedFooter(), { footer_settings: { description: 'Existing', documents: { additional: [external] } }, footer_version: 2 });
    assert.equal((await getFooter()).documents.some(({ href }) => href === promoted.path), false);
});
