import assert from 'node:assert/strict';
import test from 'node:test';
import { pool } from '../../db/client.mjs';
import { getSiteFingerprint } from '../../db/siteFingerprint.mjs';
import getSiteSettings from './siteSettings.mjs';
import { patchSiteContactSettings } from './siteContact.mjs';

const site = { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', name: 'Site' };
const context = (body) => ({ req: { json: async () => body, header: () => 'site.example.org' }, json: (value, status = 200) => ({ value, status }) });

test('settings expose saved footer props and version from the same read', async (t) => {
    const props = { description: 'Keep' };
    t.mock.method(pool, 'query', async (sql) => {
        if (sql.includes('SELECT s.id, s.slug')) return { rows: [site] };
        if (sql.includes('SELECT hostname')) return { rows: [] };
        if (sql.startsWith('SELECT contact_settings')) return { rows: [{ contact_settings: {} }] };
        assert.match(sql, /SELECT seo, footer_settings, footer_version/);
        return { rows: [{ seo: {}, footer_settings: props, footer_version: 4, defaultTemplateId: 'main' }] };
    });
    const result = await getSiteSettings(context());
    assert.deepEqual(result.value.footer, { props, version: 4 });
    assert.equal(result.value.defaultTemplateId, 'main');
});

test('saved layout and footer settings participate in the publication fingerprint without counters', async () => {
    let sql;
    await getSiteFingerprint(site.id, { query: async (query) => { sql = query; return { rows: [{ fingerprint: 'digest' }] }; } });
    assert.match(sql, /'footer_settings', footer_settings/);
    assert.match(sql, /'contact_settings', contact_settings/);
    assert.match(sql, /'default_template_id', default_template_id/);
    assert.match(sql, /FROM pages t WHERE site_id = \$1/);
    assert.match(sql, /- 'version' AS record\s+FROM page_templates/);
    assert.doesNotMatch(sql, /footer_version/);
});

test('contact API validates email and preserves footer settings', async (t) => {
    const calls = [];
    t.mock.method(pool, 'query', async (sql, values) => {
        calls.push(sql);
        if (sql.startsWith('UPDATE')) return { rows: [{ contact_settings: JSON.parse(values[1]) }] };
        return { rows: [site] };
    });
    assert.equal((await patchSiteContactSettings(context({ email: 'bad' }))).status, 400);
    const result = await patchSiteContactSettings(context({ phone: '+7999', address: 'Street', email: 'mail@example.org', socials: [] }));
    assert.equal(result.status, 200);
    assert.equal(result.value.email, 'mail@example.org');
    assert.equal(result.value.phone, '+7999');
    assert.equal(result.value.address, 'Street');
    assert.equal(calls.some((sql) => sql.includes('footer_settings')), false);
});
