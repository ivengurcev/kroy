import assert from 'node:assert/strict';
import test from 'node:test';
import { availableFooterPages, footerPageIds, normalizeFooterSettings, prepareSiteFooter } from './footerSettings.mjs';
import { contactPhoneHref, isValidContactEmail } from './contactLinks.mjs';
import { normalizeSiteContacts } from '../db/siteContacts.mjs';

const site = { id: 'site', name: 'Клиника' };
const first = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const second = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const pages = [
    { id: first, site_id: site.id, title: 'О нас', path: '/about', type: 'standard' },
    { id: second, site_id: site.id, title: 'Материалы', path: '/news', type: 'list' },
];

test('empty footer settings keep optional content empty and expose only public data', () => {
    const footer = prepareSiteFooter(site, {}, pages, 2026);
    assert.deepEqual(footer, {
        siteName: 'Клиника', year: 2026, description: '', navigation: [], documents: [],
        legal: { name: '', inn: '', registrationNumber: '' },
    });
    assert.equal(JSON.stringify(footer).includes(first), false);
    assert.equal(JSON.stringify(footer).includes('site_id'), false);
});

test('strict footer schema rejects branding switches, malformed data, excessive text/lists and unsafe URLs', () => {
    for (const value of [
        null, [], 'text', { showBranding: false }, { enabled: false }, { brandingUrl: '/elsewhere' },
        JSON.parse('{"__proto__":{"showBranding":false}}'),
        { documents: { showBranding: false } }, { legal: { color: 'red' } },
        { description: 'x'.repeat(1001) }, { navigation: Array(51).fill({ pageId: first }) },
        { navigation: ['not-a-reference'] }, { navigation: [{ pageId: 'invalid' }] },
        { documents: null }, { legal: [] }, { legal: { name: 123 } },
        ...['javascript:alert(1)', 'data:text/html,bad', '//elsewhere.org', '/privacy', 'https://', 'https://ok.org/\\evil', 'https://ok.org/\npath'].map((url) => ({
            documents: { additional: [{ label: 'Документ', url }] },
        })),
    ]) {
        assert.ok(Object.keys(normalizeFooterSettings(value).fields).length > 0, JSON.stringify(value));
    }
    const valid = normalizeFooterSettings({ documents: { additional: [{ label: ' Документ ', url: 'https://example.org/legal' }] } });
    assert.deepEqual(valid.fields, {});
    assert.equal(valid.settings.documents.additional[0].label, 'Документ');
});

test('ordered UUID links follow current titles and paths; deleted, template and cross-site pages disappear', () => {
    const settings = normalizeFooterSettings({
        navigation: [{ pageId: second }, { pageId: first }],
        documents: { privacyPageId: first, additional: [{ pageId: second }, { label: 'Внешний документ', url: 'https://example.org/legal' }] },
        legal: { name: 'ООО Клиника', inn: '1234567890', registrationNumber: '1234567890123' },
    }).settings;
    assert.deepEqual(footerPageIds(settings), [second, first]);
    const changed = [{ ...pages[0], title: 'О клинике', path: '/team' }, pages[1]];
    const footer = prepareSiteFooter(site, settings, changed, 2026);
    assert.deepEqual(footer.navigation, [{ label: 'Материалы', href: '/news' }, { label: 'О клинике', href: '/team' }]);
    assert.equal(footer.documents[0].href, '/team');
    assert.equal(footer.documents[0].label, 'Политика обработки персональных данных');
    assert.equal(footer.documents[2].href, 'https://example.org/legal');
    assert.equal(footer.legal.name, 'ООО Клиника');
    for (const patch of [{ deleted_at: 'now' }, { site_id: 'other' }, { type: 'detail', path: '/news/:slug' }, { path: '/admin' }, { path: '/auth/signin' }]) {
        const hidden = prepareSiteFooter(site, settings, [{ ...pages[0], ...patch }, pages[1]], 2026);
        assert.deepEqual(hidden.navigation, [{ label: 'Материалы', href: '/news' }]);
        assert.equal(hidden.documents.some(({ href }) => href === '/about'), false);
    }
    assert.equal(availableFooterPages([{ ...pages[0], deletedAt: 'now' }]).length, 0);
});

test('contacts stay compatible without email; mail and tel links accept only safe destinations', () => {
    assert.equal(normalizeSiteContacts({ phone: '+7 (999) 123-45-67' }).email, '');
    assert.equal(normalizeSiteContacts({ email: ' hello@example.org ' }).email, 'hello@example.org');
    assert.equal(contactPhoneHref('+7 (999) 123-45-67'), 'tel:+79991234567');
    assert.equal(contactPhoneHref('not a phone'), null);
    for (const email of ['a@example.org', 'hello+tag@example.org']) assert.equal(isValidContactEmail(email), true);
    for (const email of ['', 'bad', 'a@example.org?subject=bad', 'a@example.org\nBcc:evil', 'a@bad.org#x']) assert.equal(isValidContactEmail(email), false);
});

test('absolute same-site URLs are not used as stale internal page references', () => {
    const footer = prepareSiteFooter({ ...site, domains: ['clinic.example.org'] }, {
        documents: { additional: [
            { label: 'Internal', url: 'https://clinic.example.org/about' },
            { label: 'External', url: 'https://legal.example.org/document' },
        ] },
    }, pages, 2026);
    assert.deepEqual(footer.documents, [{ label: 'External', href: 'https://legal.example.org/document' }]);
});
