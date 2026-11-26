import assert from 'node:assert/strict';
import test from 'node:test';
import { pool } from '../../db/client.mjs';
import { patchSiteFooter } from './siteFooter.mjs';
import { getSiteFooter } from '../../db/siteFooter.mjs';
import { getSiteFingerprint } from '../../db/siteFingerprint.mjs';
import { patchSiteContactSettings } from './siteContact.mjs';
import getSiteSettings from './siteSettings.mjs';

const id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const pageId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const site = { id, name: 'Site' };
const context = (body) => ({ req: { json: async () => body, header: () => 'site.example.org' }, json: (value, status = 200) => ({ value, status }) });

test('footer API replaces only footer settings, validates page ownership and serializes with page mutations', async (t) => {
    t.mock.method(pool, 'query', async (sql, values) => {
        assert.match(sql, /d.hostname = \$1/);
        assert.deepEqual(values, ['site.example.org']);
        return { rows: [site] };
    });
    const calls = [];
    t.mock.method(pool, 'connect', async () => ({ release() {}, async query(sql, values) {
        calls.push({ sql, values });
        if (sql.includes('FROM pages')) {
            assert.match(sql, /site_id = \$1 AND id = ANY\(\$2::uuid\[\]\)/);
            assert.match(sql, /deleted_at IS NULL AND page_type <> 'detail'/);
            assert.deepEqual(values, [id, [pageId]]);
            return { rows: [{ id: pageId, site_id: id, path: '/about', title: 'About', type: 'standard' }] };
        }
        return { rows: [] };
    } }));
    const result = await patchSiteFooter(context({ description: ' Description ', navigation: [{ pageId }] }));
    assert.equal(result.status, 200);
    assert.equal(result.value.description, 'Description');
    assert.equal(calls[1].sql, 'SELECT id FROM sites WHERE id = $1 FOR UPDATE');
    const update = calls.find(({ sql }) => sql.startsWith('UPDATE'));
    assert.match(update.sql, /^UPDATE sites SET footer_settings = \$2::jsonb WHERE id = \$1$/);
    assert.deepEqual(JSON.parse(update.values[1]), result.value);
    assert.equal(calls.at(-1).sql, 'COMMIT');
});

test('footer API rejects foreign/deleted/template page references and all attempts to disable branding', async (t) => {
    t.mock.method(pool, 'query', async () => ({ rows: [site] }));
    const calls = [];
    t.mock.method(pool, 'connect', async () => ({ release() {}, async query(sql) {
        calls.push(sql);
        return { rows: [] };
    } }));
    for (const body of [
        { navigation: [{ pageId }] },
        { documents: { privacyPageId: pageId } },
        { documents: { additional: [{ pageId }] } },
        { showBranding: false }, { enabled: false }, { branding: { text: 'Other' } },
    ]) assert.equal((await patchSiteFooter(context(body))).status, 400);
    assert.equal(calls.some((sql) => sql.startsWith('UPDATE')), false);
    const malformed = context({});
    malformed.req.json = async () => { throw new Error('json'); };
    assert.equal((await patchSiteFooter(malformed)).status, 400);
});

test('footer API cannot write when host does not identify a site', async (t) => {
    t.mock.method(pool, 'query', async () => ({ rows: [] }));
    t.mock.method(pool, 'connect', async () => assert.fail('must not write'));
    assert.equal((await patchSiteFooter(context({}))).status, 404);
});

test('absolute URLs on any domain of this site must be page references instead', async (t) => {
    t.mock.method(pool, 'query', async () => ({ rows: [site] }));
    t.mock.method(pool, 'connect', async () => ({ release() {}, async query(sql, values) {
        assert.doesNotMatch(sql, /^UPDATE/);
        if (sql.includes('FROM domains')) {
            assert.deepEqual(values, [id]);
            return { rows: [{ hostname: 'alias.example.org' }] };
        }
        return { rows: [] };
    } }));
    assert.equal((await patchSiteFooter(context({
        documents: { additional: [{ label: 'Legal', url: 'https://alias.example.org/privacy' }] },
    }))).status, 400);
});

test('settings and public preview loader read footer separately; page resolution is site-scoped', async (t) => {
    t.mock.method(pool, 'query', async (sql, values) => {
        if (sql.includes('SELECT s.id, s.slug')) return { rows: [site] };
        if (sql.includes('SELECT hostname')) return { rows: [{ hostname: 'site.example.org' }] };
        if (sql.startsWith('SELECT seo')) return { rows: [{ seo: {} }] };
        if (sql.startsWith('SELECT contact_settings')) return { rows: [{ contact_settings: {} }] };
        if (sql.startsWith('SELECT footer_settings')) return { rows: [{ footer_settings: { navigation: [{ pageId }] } }] };
        assert.match(sql, /FROM pages/);
        assert.match(sql, /site_id = \$1 AND deleted_at IS NULL AND page_type <> 'detail'/);
        assert.deepEqual(values, [id]);
        return { rows: [{ id: pageId, site_id: id, path: '/team', title: 'Team', type: 'standard' }] };
    });
    const settings = await getSiteSettings(context());
    assert.deepEqual(settings.value.footer.navigation, [{ pageId }]);
    const footer = await getSiteFooter(site);
    assert.deepEqual(footer.navigation, [{ label: 'Team', href: '/team' }]);
    assert.equal(footer.siteName, 'Site');
});

test('footer settings and shared contacts participate in the existing publication fingerprint', async () => {
    let sql;
    await getSiteFingerprint(id, { query: async (query) => { sql = query; return { rows: [{ fingerprint: 'digest' }] }; } });
    assert.match(sql, /'footer_settings', footer_settings/);
    assert.match(sql, /'contact_settings', contact_settings/);
    assert.match(sql, /FROM pages t WHERE site_id = \$1/);
});

test('contact API validates email and preserves existing contacts during a normal shared-settings save', async (t) => {
    const calls = [];
    t.mock.method(pool, 'query', async (sql, values) => {
        calls.push({ sql, values });
        if (sql.startsWith('UPDATE')) return { rows: [{ contact_settings: JSON.parse(values[1]) }] };
        return { rows: [site] };
    });
    assert.equal((await patchSiteContactSettings(context({ email: 'bad' }))).status, 400);
    const result = await patchSiteContactSettings(context({ phone: '+7999', address: 'Street', email: 'mail@example.org', socials: [] }));
    assert.equal(result.status, 200);
    assert.equal(result.value.email, 'mail@example.org');
    assert.equal(result.value.phone, '+7999');
    assert.equal(result.value.address, 'Street');
    assert.equal(calls.some(({ sql }) => sql.includes('footer_settings')), false);
});
