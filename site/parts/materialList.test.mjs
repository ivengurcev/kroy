import assert from 'node:assert/strict';
import test from 'node:test';
import prepareMaterialList from './material-list/prepareMaterialList.mjs';
import { attachMaterialLists, createMaterialListData } from '../runtime/materialListData.mjs';

const published = { slug: 'example', title: 'Material', summary: 'Summary', coverUrl: '/cover.webp', status: 'published', content: { secret: 'private' } };
const draft = { ...published, slug: 'draft', status: 'draft' };

test('material-list data exposes only published card fields and resolves the selected section detail URL', () => {
    const data = createMaterialListData([draft, published], { path: '/cases/:slug', routeParam: 'slug' });
    assert.equal(JSON.stringify(data).includes('private'), false);
    assert.deepEqual(prepareMaterialList({ props: { sectionId: 'a' }, materials: { a: data } }), [
        { slug: 'example', title: 'Material', summary: 'Summary', coverUrl: '/cover.webp', href: '/cases/example' },
    ]);
});

test('dynamic Page section overrides block section and missing template leaves cards unlinked', () => {
    const sections = {
        a: createMaterialListData([published], { path: '/a/:slug', routeParam: 'slug' }),
        b: createMaterialListData([{ ...published, slug: 'other' }], null),
    };
    assert.equal(prepareMaterialList({ props: { sectionId: 'a' }, materialSectionId: 'b', materials: sections })[0].href, null);
    assert.equal(prepareMaterialList({ props: { sectionId: 'missing' }, materials: sections }).length, 0);
});

test('list attachments expose per-section data to ordinary Pages and keep detail templates section-scoped', () => {
    const pages = [{ id: 'home', path: '/', type: 'standard' }, { id: 'list', type: 'list', dataSource: 'materials', materialSectionId: 'a' }];
    const attached = attachMaterialLists(pages, { a: [published], b: [] }, [
        { materialSectionId: 'a', path: '/a/:slug', routeParam: 'slug' },
    ]);
    assert.equal(attached[0].materials.a.items.length, 1);
    assert.equal(attached[0].materials.a.detailTemplate.path, '/a/:slug');
    assert.equal(attached[1].materialSectionId, 'a');
    assert.equal(attached[1].materials.b.detailTemplate, null);
});
