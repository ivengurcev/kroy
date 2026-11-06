import assert from 'node:assert/strict';
import test from 'node:test';
import { isPublishableMaterial, normalizeMaterialInput, postSiteMaterial, patchSiteMaterial } from './materials.mjs';
import { pool } from '../../db/client.mjs';

test('material input requires a section and valid material fields', () => {
    assert.equal(normalizeMaterialInput({ slug: 'case', title: 'Case' }), null);
    assert.deepEqual(normalizeMaterialInput({ sectionId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', slug: 'case', title: 'Case' }), {
        sectionId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', slug: 'case', title: 'Case', summary: '', content: null, coverMediaId: null, status: 'draft',
    });
    assert.equal(normalizeMaterialInput({ sectionId: 'bad', slug: 'case', title: 'Case' }), null);
});

test('material patches permit section moves and clearing optional values', () => {
    assert.deepEqual(normalizeMaterialInput({ sectionId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', content: null, coverMediaId: null }, { partial: true }), {
        sectionId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', content: null, coverMediaId: null,
    });
});

test('published materials require non-empty Lexical text', () => {
    assert.equal(isPublishableMaterial({ status: 'published', content: null }), false);
    assert.equal(isPublishableMaterial({ status: 'published', content: { root: { type: 'root', children: [] } } }), false);
    assert.equal(isPublishableMaterial({ status: 'published', content: { root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text: 'Text' }] }] } } }), true);
});

function context(body) {
    return {
        req: { json: async () => body, param: () => 'cccccccc-cccc-cccc-cccc-cccccccccccc', header: (name) => name === 'Host' ? 'materials.localhost' : undefined },
        json: (value, status = 200) => ({ value, status }),
    };
}

test('API reports title, slug and section errors by field before touching the database', async (t) => {
    t.mock.method(pool, 'query', () => { throw new Error('Unexpected database access'); });
    const result = await postSiteMaterial(context({ title: ' ', slug: '/Bad-slug', sectionId: '' }));
    assert.equal(result.status, 400);
    assert.equal(result.value.fields.title, 'Укажите название');
    assert.match(result.value.fields.slug, /латинские буквы/);
    assert.equal(result.value.fields.sectionId, 'Выберите раздел');
    const patch = await patchSiteMaterial(context({ slug: 'Invalid' }));
    assert.equal(patch.status, 400);
    assert.deepEqual(Object.keys(patch.value.fields), ['slug']);
});

test('duplicate material slug is a field conflict with a safe user-facing message', async (t) => {
    t.mock.method(pool, 'query', async (sql) => {
        if (sql.includes('JOIN domains')) return { rows: [{ id: 'site' }] };
        if (sql.includes('INSERT INTO materials')) throw Object.assign(new Error('private database detail'), { code: '23505' });
        if (sql.includes('SELECT 1 FROM material_sections')) return { rowCount: 1 };
        throw new Error(`Unexpected query: ${sql}`);
    });
    const result = await postSiteMaterial(context({ sectionId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', title: 'Название', slug: 'existing-slug' }));
    assert.equal(result.status, 409);
    assert.deepEqual(result.value.fields, { slug: 'Такой адрес уже используется' });
    assert.doesNotMatch(JSON.stringify(result), /private/);
});

test('ready-for-publication material still requires text and reports the content field', async () => {
    const result = await postSiteMaterial(context({ sectionId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', title: 'Название', slug: 'title', status: 'published' }));
    assert.equal(result.status, 400);
    assert.match(result.value.fields.content, /Добавьте текст/);
});
