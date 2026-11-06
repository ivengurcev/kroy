import assert from 'node:assert/strict';
import test from 'node:test';
import { pageConflictFields, pageFieldErrors } from './formErrors.mjs';
import postPage from './postPage.mjs';

test('page validation and conflicts address the corresponding form fields', async () => {
    assert.deepEqual(pageConflictFields(), { path: 'Такой адрес уже используется' });
    assert.deepEqual(pageConflictFields({ constraint: 'pages_one_active_material_list_per_section' }), { materialSectionId: 'У этого раздела уже есть страница-список' });
    assert.deepEqual(Object.keys(pageFieldErrors({ title: ' ', path: '/Bad', routeParam: '1bad' })), ['title', 'path', 'routeParam']);
    const response = await postPage({ req: { json: async () => ({ title: '', path: '/Bad' }) }, json: (body, status) => ({ body, status }) });
    assert.equal(response.status, 400);
    assert.equal(response.body.fields.title, 'Укажите название');
    assert.ok(response.body.fields.path);
});
