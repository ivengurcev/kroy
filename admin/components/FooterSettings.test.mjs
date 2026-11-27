import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';

test('footer fields edit a draft and offer only eligible pages', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => assert.fail('Footer fields must not make requests'));
    const pages = [
            { id: 'home', title: 'Главная', path: '/', type: 'standard' },
            { id: 'list', title: 'Материалы', path: '/news', type: 'list' },
            { id: 'detail', title: 'Шаблон', path: '/news/:slug', type: 'detail' },
            { id: 'deleted', title: 'Удалённая', path: '/gone', deleted_at: 'now' },
            { id: 'service', title: 'Служебная', path: '/admin' },
            { id: 'legal', title: 'Условия', path: '/terms', type: 'standard', isLegalDocument: true },
            { id: 'removed-legal', title: 'Удалённые условия', path: '/old-terms', isLegalDocument: true, deleted_at: 'now' },
    ];
    const result = await build({
        entryPoints: ['admin/components/FooterSettings.jsx'], bundle: true, write: false, format: 'esm', jsx: 'automatic',
        plugins: [{ name: 'footer-form-unit', setup(builder) {
            builder.onResolve({ filter: /^react$/ }, ({ importer }) => importer.endsWith('FooterSettings.jsx')
                ? { path: 'react', namespace: 'unit' } : undefined);
            builder.onResolve({ filter: /^react\/jsx-runtime$|ListField\.jsx$|LegalDocumentDialog\.jsx$|Icon\.jsx$|\.module\.css$/ }, ({ path }) => ({ path, namespace: 'unit' }));
            builder.onLoad({ filter: /./, namespace: 'unit' }, ({ path }) => {
                if (path === 'react') return { contents: 'let state; export const useState=(initial)=>[state ?? initial,next=>{state=next;}]; export const useEffect=()=>{};' };
                if (path === 'react/jsx-runtime') return { contents: 'export const Fragment="fragment"; export const jsx=(type,props)=>({type,props}); export const jsxs=jsx;' };
                return { contents: `export default ${JSON.stringify(path.endsWith('.css') ? {} : path.split('/').pop().replace('.jsx', ''))};` };
            });
        } }],
    });
    const { default: FooterSettings } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
    let value = { documents: { offerPageId: 'home', additional: [{ pageId: 'list' }] } };
    const savedDocuments = [];
    function render() {
        return FooterSettings({ value, pages, legalDocumentActions: { onSaved: (page) => savedDocuments.push(page) },
            onChange: (next) => { value = next; } });
    }
    function findAll(node, predicate) {
        if (!node || typeof node !== 'object') return [];
        if (Array.isArray(node)) return node.flatMap((child) => findAll(child, predicate));
        if (typeof node.type === 'function') return findAll(node.type(node.props), predicate);
        return [...(predicate(node) ? [node] : []), ...findAll(node.props?.children, predicate)];
    }
    let tree = render();
    const lists = findAll(tree, ({ type }) => type === 'ListField');
    assert.deepEqual(lists.map(({ props }) => props.label), ['Навигация', 'Внешние документы']);
    assert.equal(findAll(tree, ({ props }) => props?.title === 'Условия — /terms').length, 1);
    assert.equal(findAll(tree, ({ props }) => props?.title === 'Удалённые условия — /old-terms').length, 0);
    assert.equal(findAll(tree, ({ props }) => props?.title === 'Редактировать документ').length, 1);
    assert.equal(findAll(tree, ({ props }) => props?.children?.includes?.(' Добавить документ')).length, 1);
    const navigation = lists[0].props;
    const selectTree = navigation.renderItem({ pageId: 'home' }, 0, () => {});
    const select = findAll(selectTree, ({ type }) => type === 'select')[0];
    assert.deepEqual(findAll(select, ({ type }) => type === 'option').map(({ props }) => props.value), ['', 'home', 'list', 'legal']);
    navigation.onChange([{ pageId: 'list' }, { pageId: 'home' }]);
    tree = render();
    assert.deepEqual(findAll(tree, ({ type }) => type === 'ListField')[0].props.value, [{ pageId: 'list' }, { pageId: 'home' }]);
    const additional = findAll(tree, ({ type }) => type === 'ListField')[1].props;
    additional.onChange([{ pageId: undefined, label: 'Document', url: 'https://example.org/legal' }]);
    assert.deepEqual(value.documents.additional, [{ pageId: 'list' }, { label: 'Document', url: 'https://example.org/legal' }]);
    assert.equal(value.documents.offerPageId, 'home');
    assert.equal(findAll(tree, ({ props }) => props?.href === '/admin/contacts').length, 1);
    assert.equal(findAll(tree, ({ props }) => props?.name === 'showBranding').length, 0);
    assert.equal(tree.props.onSubmit, undefined);

    const footerDraft = value;
    findAll(tree, ({ props }) => props?.children?.includes?.(' Добавить документ'))[0].props.onClick();
    const [newDialog] = findAll(render(), ({ type }) => type === 'LegalDocumentDialog');
    assert.equal(newDialog.props.id, undefined);
    newDialog.props.onSaved({ id: 'new-legal', title: 'Новый документ' });
    assert.deepEqual(savedDocuments, [{ id: 'new-legal', title: 'Новый документ' }]);
    assert.equal(value, footerDraft);
    assert.equal(findAll(render(), ({ type }) => type === 'LegalDocumentDialog').length, 0);
    findAll(render(), ({ props }) => props?.title === 'Редактировать документ')[0].props.onClick();
    assert.equal(findAll(render(), ({ type }) => type === 'LegalDocumentDialog')[0].props.id, 'legal');
});
